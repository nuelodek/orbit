<?php
// get_google_tokens.php - Get user's Google OAuth tokens and YouTube info

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Include database configuration
require_once 'config.php';

try {
    $user_email = $_GET['user_email'] ?? '';

    if (empty($user_email)) {
        throw new Exception('User email is required');
    }

    // Get user Google OAuth data
    $sql = "SELECT google_access_token, google_refresh_token, google_token_expiry,
                   youtube_channel_id, youtube_channel_name, google_account_linked,
                   google_account_email
            FROM growsignup
            WHERE email = ?";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $user_email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $user_data = $result->fetch_assoc();

        // Check if tokens are still valid
        $token_valid = true;
        if (!empty($user_data['google_token_expiry'])) {
            $expiry_time = strtotime($user_data['google_token_expiry']);
            $current_time = time();
            $token_valid = ($expiry_time > $current_time + 300); // 5 minutes buffer
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'google_access_token' => $user_data['google_access_token'],
                'google_refresh_token' => $user_data['google_refresh_token'],
                'google_token_expiry' => $user_data['google_token_expiry'],
                'youtube_channel_id' => $user_data['youtube_channel_id'],
                'youtube_channel_name' => $user_data['youtube_channel_name'],
                'google_account_linked' => (bool)$user_data['google_account_linked'],
                'google_account_email' => $user_data['google_account_email'],
                'token_valid' => $token_valid
            ]
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'User not found'
        ]);
    }

    $stmt->close();

} catch (Exception $e) {
    error_log('Get Google tokens error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

$conn->close();
?>