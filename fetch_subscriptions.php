<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Database connection
$servername = "localhost";
$username = "growsoci_admin";
$password = "uiHEEmAELay9";
$dbname = "growsoci_db";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode(['success' => false, 'error' => 'Database connection failed']));
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'get_available_channels':
        // Fetch available subscriptions (exclude channels posted by current user)
        $user_email = $_GET['user_email'] ?? '';
        if (empty($user_email)) {
            echo json_encode(['success' => false, 'error' => 'User email is required']);
            break;
        }

        $sql = "SELECT id, email, channelname, currency, rate, channelurl, channeldescription, channelcategory, subscriptions, subscriptionneeded, amountincurred, uploaddate FROM youtube_subscriptions WHERE email != ? ORDER BY uploaddate DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $user_email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result) {
            $subscriptions = [];
            while ($row = $result->fetch_assoc()) {
                $subscriptions[] = [
                    'id' => $row['id'],
                    'poster_email' => $row['email'],
                    'channel_name' => $row['channelname'],
                    'currency' => $row['currency'],
                    'rate' => $row['rate'],
                    'channel_url' => $row['channelurl'],
                    'description' => $row['channeldescription'],
                    'category' => $row['channelcategory'],
                    'current_subscriptions' => $row['subscriptions'],
                    'subscription_needed' => $row['subscriptionneeded'],
                    'amount_incurred' => $row['amountincurred'],
                    'upload_date' => $row['uploaddate']
                ];
            }
            echo json_encode(['success' => true, 'subscriptions' => $subscriptions]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to fetch subscriptions']);
        }
        break;

    case 'track_subscription':
    // Handle subscription tracking
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        echo json_encode(['success' => false, 'error' => 'Invalid JSON data']);
        exit;
    }

    $user_email = $data['user_email'] ?? '';
    $subscription_id = $data['subscription_id'] ?? 0;
    $poster_email = $data['poster_email'] ?? '';
    $rate = $data['rate'] ?? 0;
    $currency = $data['currency'] ?? 'NGN';
    $youtube_account = $data['youtube_account'] ?? '';

    if (empty($user_email) || empty($subscription_id) || empty($youtube_account)) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    // Start transaction
    $conn->begin_transaction();

    try {
        // Check if user already subscribed to this channel with this YouTube account
        $check_sql = "SELECT id FROM youtubesub_count WHERE user_email = ? AND youtube_subscriptions_id = ? AND youtube_account = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param("sis", $user_email, $subscription_id, $youtube_account);
        $check_stmt->execute();
        $check_result = $check_stmt->get_result();

        if ($check_result->num_rows > 0) {
            echo json_encode(['success' => false, 'error' => 'Already subscribed to this channel with this YouTube account']);
            $conn->rollback();
            exit;
        }

        // Insert into youtubesub_count
        $insert_count_sql = "INSERT INTO youtubesub_count (user_email, youtube_subscriptions_id, youtube_account) VALUES (?, ?, ?)";
        $insert_count_stmt = $conn->prepare($insert_count_sql);
        $insert_count_stmt->bind_param("sis", $user_email, $subscription_id, $youtube_account);
        $insert_count_stmt->execute();

        // Insert payment record
        $insert_payment_sql = "INSERT INTO youtubepayments (youtube_subscriptions_id, user_email, poster_email, youtube_rate, currency) VALUES (?, ?, ?, ?, ?)";
        $insert_payment_stmt = $conn->prepare($insert_payment_sql);
        $insert_payment_stmt->bind_param("issds", $subscription_id, $user_email, $poster_email, $rate, $currency);
        $insert_payment_stmt->execute();

        // Update subscription count
        $update_sql = "UPDATE youtube_subscriptions SET subscriptions = subscriptions + 1 WHERE id = ?";
        $update_stmt = $conn->prepare($update_sql);
        $update_stmt->bind_param("i", $subscription_id);
        $update_stmt->execute();

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Subscription tracked successfully']);

    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'error' => 'Failed to track subscription: ' . $e->getMessage()]);
    }
        break;

    case 'get_user_rewards':
        $user_email = $_GET['email'] ?? '';
        if (empty($user_email)) {
            echo json_encode(['status' => 'error', 'message' => 'Email is required']);
            break;
        }

        // Get user rewards from youtubepayments table
        $sql = "SELECT yp.youtube_rate as amount, yp.currency, yp.created_at, ys.channelname as channel_name
                FROM youtubepayments yp
                JOIN youtube_subscriptions ys ON yp.youtube_subscriptions_id = ys.id
                WHERE yp.user_email = ?
                ORDER BY yp.created_at DESC";

        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $user_email);
        $stmt->execute();
        $result = $stmt->get_result();

        $rewards = [];
        while ($row = $result->fetch_assoc()) {
            $rewards[] = [
                'amount' => $row['amount'],
                'currency' => $row['currency'],
                'channel_name' => $row['channel_name'],
                'earned_at' => $row['created_at'],
                'timestamp' => $row['created_at']
            ];
        }

        echo json_encode(['status' => 'success', 'rewards' => $rewards]);
        break;

    case 'get_rewarded_channels':
        $user_email = $_POST['user_email'] ?? '';
        if (empty($user_email)) {
            echo json_encode(['status' => 'error', 'message' => 'User email is required']);
            break;
        }

        // Get channels that user hasn't subscribed to yet
        $sql = "SELECT ys.id, ys.channelname, ys.channelurl, ys.rate, ys.currency, ys.channeldescription, ys.channelcategory
                FROM youtube_subscriptions ys
                WHERE ys.id NOT IN (
                    SELECT youtube_subscriptions_id
                    FROM youtubesub_count
                    WHERE user_email = ?
                )
                ORDER BY ys.uploaddate DESC";

        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $user_email);
        $stmt->execute();
        $result = $stmt->get_result();

        $channels = [];
        while ($row = $result->fetch_assoc()) {
            $channels[] = [
                'id' => $row['id'],
                'channelName' => $row['channelname'],
                'channelUrl' => $row['channelurl'],
                'rate' => $row['rate'],
                'currency' => $row['currency'],
                'description' => $row['channeldescription'],
                'category' => $row['channelcategory'],
                'channelId' => 'UC' . substr(md5($row['channelname']), 0, 22) // Generate mock channel ID
            ];
        }

        echo json_encode(['status' => 'success', 'channels' => $channels]);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
        break;
}

$conn->close();
?>