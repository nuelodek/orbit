<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

if ($_SERVER["REQUEST_METHOD"] == "GET") {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
}

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database connection
$servername = "localhost";
$username = "growsoci_admin";
$password = "uiHEEmAELay9";
$database = "growsoci_db";
$conn = new mysqli($servername, $username, $password, $database);
if ($conn->connect_error) {
    echo json_encode(['status' => 'error', 'message' => "Connection failed: " . $conn->connect_error]);
    exit;
}
// Get the email from the request data
$email = isset($_GET['email']) ? filter_var($_GET['email'], FILTER_SANITIZE_EMAIL) : (isset($data['email']) ? filter_var($data['email'], FILTER_SANITIZE_EMAIL) : '');

// Get the category parameter from the request
$category = isset($_GET['category']) ? filter_var($_GET['category'], FILTER_SANITIZE_STRING) : (isset($data['category']) ? filter_var($data['category'], FILTER_SANITIZE_STRING) : '');

// Get the search query parameter from the request
$searchQuery = isset($_GET['search']) ? filter_var($_GET['search'], FILTER_SANITIZE_STRING) : (isset($data['search']) ? filter_var($data['search'], FILTER_SANITIZE_STRING) : '');

// Validate the email format
// Security check for potential code injection
if (preg_match('/<\?php|<script|<\?xml|<\?html|function\s*\(|console\.[a-zA-Z]+\s*\(|document\.[a-zA-Z]+\s*\(|<\w+\s*>|<\/\w+\s*>/', $email . $category . $searchQuery)) {
    echo json_encode(['status' => 'error', 'message' => 'Potential code injection detected']);
    exit;
}

// SQL to select data from the youtube_subscriptions table
$sql = "SELECT * FROM youtube_subscriptions 
        WHERE email != '$email'
        AND id NOT IN (
            SELECT youtube_subscriptions_id 
            FROM youtubesub_count 
            WHERE user_email = '$email'
        )
        AND subscriptionneeded != subscriptions";

// If a search query is provided, add it to the SQL query
if (!empty($searchQuery)) {
    $sql .= " AND (
        channelname LIKE '%$searchQuery%' OR 
        channeldescription LIKE '%$searchQuery%' OR 
        email LIKE '%$searchQuery%' OR 
        currency LIKE '%$searchQuery%' OR 
        channelcategory LIKE '%$searchQuery%' OR 
        channelurl LIKE '%$searchQuery%'
    )";
}

// If a category is specified and it's not "All", add it to the SQL query
if (!empty($category) && $category !== 'All') {
    $sql .= " AND channelcategory = '$category'";
}

$sql .= " ORDER BY RAND()";

$result = $conn->query($sql);
$channels = array();

if ($result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $channels[] = array(
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
        );
    }
    echo json_encode(['status' => 'success', 'data' => $channels]);
} else {
    $message = !empty($searchQuery) ? 
        'No channels found for your search query' : 
        (!empty($category) && $category !== 'All' ? 
            'No channels found for the ' . $category . ' category' : 
            'No channels available');
    
    echo json_encode(['status' => 'empty', 'message' => $message]);
}

$conn->close();
