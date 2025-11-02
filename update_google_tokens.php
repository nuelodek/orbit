<?php
// update_google_tokens.php - Update user's Google OAuth tokens and YouTube info

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Include database configuration
require_once 'config.php';

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        throw new Exception('Invalid JSON input');
    }

    $user_email = $input['user_email'] ?? '';
    $google_access_token = $input['google_access_token'] ?? '';
    $google_refresh_token = $input['google_refresh_token'] ?? '';
    $google_token_expiry = $input['google_token_expiry'] ?? '';
    $youtube_channel_id = $input['youtube_channel_id'] ?? '';
    $youtube_channel_name = $input['youtube_channel_name'] ?? '';
    $google_account_email = $input['google_account_email'] ?? '';

    // Validate required fields
    if (empty($user_email)) {
        throw new Exception('User email is required');
    }

    // Prepare update query
    $update_fields = [];
    $params = [];
    $types = '';

    if (!empty($google_access_token)) {
        $update_fields[] = 'google_access_token = ?';
        $params[] = $google_access_token;
        $types .= 's';
    }

    if (!empty($google_refresh_token)) {
        $update_fields[] = 'google_refresh_token = ?';
        $params[] = $google_refresh_token;
        $types .= 's';
    }

    if (!empty($google_token_expiry)) {
        $update_fields[] = 'google_token_expiry = ?';
        $params[] = $google_token_expiry;
        $types .= 's';
    }

    if (!empty($youtube_channel_id)) {
        $update_fields[] = 'youtube_channel_id = ?';
        $params[] = $youtube_channel_id;
        $types .= 's';
    }

    if (!empty($youtube_channel_name)) {
        $update_fields[] = 'youtube_channel_name = ?';
        $params[] = $youtube_channel_name;
        $types .= 's';
    }

    if (!empty($google_account_email)) {
        $update_fields[] = 'google_account_email = ?';
        $params[] = $google_account_email;
        $types .= 's';
    }

    // Always update the linked status
    $update_fields[] = 'google_account_linked = 1';
    $params[] = $user_email;
    $types .= 's';

    if (empty($update_fields)) {
        throw new Exception('No fields to update');
    }

    $sql = "UPDATE growsignup SET " . implode(', ', $update_fields) . " WHERE email = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();

    if ($stmt->affected_rows > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Google tokens and YouTube info updated successfully'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'No user found with that email or no changes made'
        ]);
    }

    $stmt->close();

} catch (Exception $e) {
    error_log('Google tokens update error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

$conn->close();
?>