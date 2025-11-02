<?php
// Database configuration
// Move this file outside the web root or use environment variables for production

$response = ["status" => "error", "message" => "An error occurred."];

$servername = "localhost";
$username = "growsoci_admin";
$password = "uiHEEmAELay9";
$database = "growsoci_db";

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = new mysqli($servername, $username, $password, $database);
    $conn->set_charset("utf8mb4");

    // Global response variable for error handling
    $response = ["status" => "success"];

} catch (mysqli_sql_exception $e) {
    error_log("Database connection failed: " . $e->getMessage());
    $response = ["status" => "error", "message" => "Database connection failed."];
    $conn = null;
}
?>