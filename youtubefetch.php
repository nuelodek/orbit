<?php
header('Access-Control-Allow-Origin: https://growsocial.com.ng');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Handle batch subscription verification
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    $email = $data['email'] ?? '';
    $subscriptions = $data['subscriptions'] ?? [];

    // Input validation
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid email']);
        exit;
    }
    if (!is_array($subscriptions)) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid subscriptions data']);
        exit;
    }

    // PDO connection
    try {
        $pdo = new PDO("mysql:host=$servername;dbname=$database", $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
        exit;
    }

    $newRewards = [];
    $verifiedChannels = [];

    foreach ($subscriptions as $channelId) {
        // Check if already rewarded
        $stmt = $pdo->prepare("SELECT id FROM youtubesub_count WHERE user_email = ? AND youtube_subscriptions_id = ?");
        $stmt->execute([$email, $channelId]);
        if ($stmt->fetch()) {
            // Already rewarded
            continue;
        }

        // Insert into youtubesub_count
        $stmt = $pdo->prepare("INSERT INTO youtubesub_count (user_email, youtube_subscriptions_id) VALUES (?, ?)");
        $stmt->execute([$email, $channelId]);

        // Get channel details
        $stmt = $pdo->prepare("SELECT email, rate, currency FROM youtube_subscriptions WHERE id = ?");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($channel) {
            // Insert reward
            $stmt = $pdo->prepare("INSERT INTO youtubepayments (youtube_subscriptions_id, user_email, poster_email, youtube_rate, currency) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$channelId, $email, $channel['email'], $channel['rate'], $channel['currency']]);

            $newRewards[] = [
                'channelId' => $channelId,
                'rate' => $channel['rate'],
                'currency' => $channel['currency']
            ];
            $verifiedChannels[] = $channelId;
        }
    }

    echo json_encode([
        'status' => 'success',
        'verifiedChannels' => $verifiedChannels,
        'newRewards' => $newRewards
    ]);
    exit;
}

// Handle GET request for fetching channels
if ($_SERVER["REQUEST_METHOD"] == "GET") {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
}

// Get inputs
$email = isset($_GET['email']) ? $_GET['email'] : (isset($data['email']) ? $data['email'] : '');
$category = isset($_GET['category']) ? $_GET['category'] : (isset($data['category']) ? $data['category'] : '');
$searchQuery = isset($_GET['search']) ? $_GET['search'] : (isset($data['search']) ? $data['search'] : '');

// Input validation
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid email']);
    exit;
}
if (preg_match('/<\?php|<script|<\?xml|<\?html|function\s*\(|console\.[a-zA-Z]+\s*\(|document\.[a-zA-Z]+\s*\(|<\w+\s*>|<\/\w+\s*>/', $email . $category . $searchQuery)) {
    echo json_encode(['status' => 'error', 'message' => 'Potential code injection detected']);
    exit;
}

// PDO connection
try {
    $pdo = new PDO("mysql:host=$servername;dbname=$database", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    error_log('Database connection failed: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}

// Build query
$sql = "SELECT * FROM youtube_subscriptions WHERE email != ? AND id NOT IN (SELECT youtube_subscriptions_id FROM youtubesub_count WHERE user_email = ?) AND subscriptionneeded != subscriptions";
$params = [$email, $email];

if (!empty($searchQuery)) {
    $sql .= " AND (channelname LIKE ? OR channeldescription LIKE ? OR email LIKE ? OR currency LIKE ? OR channelcategory LIKE ? OR channelurl LIKE ?)";
    $likeParam = '%' . $searchQuery . '%';
    $params = array_merge($params, [$likeParam, $likeParam, $likeParam, $likeParam, $likeParam, $likeParam]);
}

if (!empty($category) && $category !== 'All') {
    $sql .= " AND channelcategory = ?";
    $params[] = $category;
}

$sql .= " ORDER BY RAND()";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $channels = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($channels) {
        $result = array_map(function($row) {
            return [
                'id' => $row['id'],
                'channelName' => $row['channelname'],
                'description' => $row['channeldescription'],
                'rate' => $row['rate'],
                'currency' => $row['currency'],
                'email' => $row['email'],
                'channelUrl' => $row['channelurl'],
                'subscriptions' => $row['subscriptions'],
                'uploadDate' => $row['uploaddate'],
                'amountIncurred' => $row['amountincurred'],
                'category' => $row['channelcategory']
            ];
        }, $channels);
        echo json_encode(['status' => 'success', 'data' => $result]);
    } else {
        $message = !empty($searchQuery) ? 'No channels found for your search query' : (!empty($category) && $category !== 'All' ? 'No channels found for the ' . $category . ' category' : 'No channels available');
        echo json_encode(['status' => 'empty', 'message' => $message]);
    }
} catch (PDOException $e) {
    error_log('Query failed: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Query failed']);
}
