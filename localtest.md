# Local Testing Guide for Orbit Extension

## Introduction

This comprehensive guide provides step-by-step instructions for testing the Orbit Chrome extension locally. The Orbit extension integrates with the YouTube API to track user subscriptions and communicates with a PHP backend hosted on GrowSocial for data processing and rewards. Local testing ensures all components work correctly before deployment.

## Prerequisites

Before starting, ensure you have the following:

- **Google Chrome Browser**: Latest stable version
- **PHP Environment**: PHP 7.4 or higher with MySQL support
- **Local Server**: XAMPP, WAMP, or MAMP for easy PHP/MySQL setup
- **Google Cloud Console Account**: For OAuth and API access
- **Basic Knowledge**: Familiarity with Chrome DevTools and command line
- **Project Files**: Complete Orbit extension codebase in your workspace

## 1. Google Cloud Console Setup

Set up OAuth credentials for YouTube API access.

### Steps:

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3:
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Chrome Extension" as application type
   - Enter your extension's name
5. Configure authorized redirect URIs:
   - Add: `chrome-extension://[YOUR_EXTENSION_ID]/`
   - Note: You'll get the extension ID after loading the extension (see Section 2)
6. Copy the Client ID - you'll need this for the manifest.json

### Verification:
- Ensure the YouTube Data API is enabled
- Confirm OAuth consent screen is configured with appropriate scopes

## 2. Chrome Extension Loading

Load the unpacked extension into Chrome for development.

### Steps:

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select your Orbit project directory (`c:/Users/HP/orbit`)
6. The extension should appear in the extensions list
7. Note the Extension ID from the extension card (needed for OAuth setup)

### Verification:
- Extension icon appears in Chrome toolbar
- Popup opens when clicked
- No errors in chrome://extensions/ page

## 3. OAuth Configuration

Configure the extension to use your Google Cloud credentials.

### Steps:

1. Open `manifest.json`
2. Replace `"client_id": "placeholder_client_id"` with your actual Client ID from Google Cloud Console
3. Ensure the scopes match: `"scopes": ["https://www.googleapis.com/auth/youtube.readonly"]`
4. Reload the extension in `chrome://extensions/` (click the refresh icon)

### Verification:
- Manifest validates without errors
- OAuth flow initiates correctly when triggered

## 4. Local PHP Server Setup

Set up the local PHP backend for testing.

### Steps:

1. Install XAMPP (or similar):
   - Download from [apachefriends.org](https://www.apachefriends.org/)
   - Install with default settings
2. Start XAMPP Control Panel
3. Start Apache and MySQL modules
4. Create a directory in `htdocs` called `orbit`
5. Copy all PHP files (`config.php`, `youtubefetch.php`, etc.) to `htdocs/orbit/`
6. Update `config.php` for local database:
   ```php
   $servername = "localhost";
   $username = "root";  // Default XAMPP username
   $password = "";      // Default XAMPP password (empty)
   $database = "orbit_test";
   ```
7. Create the local database:
   - Open phpMyAdmin at `http://localhost/phpmyadmin/`
   - Create database named `orbit_test`
   - Import any required tables from `subscrption.sql`
8. Test PHP setup:
   - Visit `http://localhost/orbit/youtubefetch.php`
   - Should load without fatal errors

### Verification:
- Apache and MySQL running (green in XAMPP)
- phpMyAdmin accessible
- PHP files load without syntax errors

## 5. Extension URL Updates

Update hardcoded URLs to point to your local server.

### Steps:

1. Open `background.js`
2. Replace all instances of `https://growsocial.com.ng` with `http://localhost/orbit`
   - Login endpoint: `https://growsocial.com.ng/growlogin.php` → `http://localhost/orbit/growlogin.php`
   - Profile fetch: `https://growsocial.com.ng/api/fetchprofile.php` → `http://localhost/orbit/api/fetchprofile.php`
   - Subscription tracking: `https://growsocial.com.ng/api/track-subscription.php` → `http://localhost/orbit/api/track-subscription.php`
   - Rewarded channels: `https://growsocial.com.ng/api/get-rewarded-channels.php` → `http://localhost/orbit/api/get-rewarded-channels.php`
3. Check other files (`popup.js`, `content.js`) for any hardcoded URLs
4. Reload the extension after changes

### Verification:
- All fetch requests in background.js point to localhost
- No remaining production URLs

## 6. Testing Procedures

Execute comprehensive tests to verify functionality.

### Basic Functionality Test:

1. Click the Orbit extension icon
2. Click "Login" and enter test credentials
3. Grant OAuth permissions when prompted
4. Navigate to `https://www.youtube.com`
5. Subscribe to any channel
6. Check extension popup for confirmation
7. Verify data in local database via phpMyAdmin

### Automated Polling Test:

1. Ensure user is logged in with OAuth granted
2. Wait for alarm to trigger (every 5 minutes) or manually trigger polling
3. Check console logs for polling activity
4. Verify new subscriptions are detected and rewarded

### Verification:
- Login successful
- OAuth token obtained
- Subscription events tracked
- Data appears in local database

## 7. Debugging Common Issues

Troubleshoot frequently encountered problems.

### OAuth Authentication Errors:
- **Issue**: "OAuth error" in console
- **Solution**: 
  - Verify Client ID in manifest.json
  - Check authorized redirect URIs include extension ID
  - Ensure YouTube Data API is enabled
  - Clear browser cache and retry

### PHP Connection Errors:
- **Issue**: "Failed to fetch" or network errors
- **Solution**:
  - Confirm Apache/MySQL running
  - Check URLs in background.js
  - Verify PHP files exist and are accessible
  - Check PHP error logs in XAMPP

### Extension Loading Errors:
- **Issue**: Extension not loading or "Manifest error"
- **Solution**:
  - Validate manifest.json syntax (use JSON validator)
  - Ensure all required files exist
  - Check file paths are correct
  - Reload extension after changes

### Database Connection Issues:
- **Issue**: PHP cannot connect to MySQL
- **Solution**:
  - Verify MySQL is running
  - Check credentials in config.php
  - Ensure database exists
  - Test connection via phpMyAdmin

## 8. Log Monitoring

Monitor extension activity and debug issues.

### Chrome DevTools Console:
1. Right-click extension icon > "Inspect popup"
2. Switch to "Console" tab
3. Monitor for errors and log messages
4. Use `console.log` statements in scripts for debugging

### Background Script Logs:
1. Go to `chrome://extensions/`
2. Find Orbit extension > "Inspect views: background page"
3. Monitor console for OAuth, API calls, and polling activity

### Network Monitoring:
1. Open DevTools > "Network" tab
2. Filter by domain (localhost, youtube.com, etc.)
3. Check request/response status for API calls

### PHP Error Logs:
- Location: `XAMPP/apache/logs/error.log`
- Check for PHP fatal errors or warnings
- Enable error reporting in PHP files for detailed logs

## 9. Edge Case Testing

Test unusual scenarios to ensure robustness.

### Network Conditions:
- Test with slow/intermittent internet
- Test offline functionality (if applicable)
- Verify behavior when YouTube API is rate-limited

### Multiple Sessions:
- Test with multiple Chrome profiles
- Test extension behavior across different tabs/windows
- Verify data isolation between users

### OAuth Edge Cases:
- Test token expiration and refresh
- Test with revoked permissions
- Test OAuth flow interruption

### Subscription Scenarios:
- Test subscribing/unsubscribing rapidly
- Test with private channels
- Test with channels that have special characters in names
- Verify duplicate subscription handling

### Error Recovery:
- Test extension behavior after PHP server restart
- Test with corrupted local storage
- Test alarm scheduling and recovery

### Performance Testing:
- Monitor memory usage during extended use
- Test with large numbers of subscriptions
- Verify polling doesn't impact browser performance

---

## Additional Notes

- Always test in an incognito window to avoid cached data interference
- Keep Google Cloud Console and local server credentials secure
- Document any custom test scenarios specific to your development environment
- Regularly update OAuth credentials if the extension ID changes
- Backup local database before major testing sessions

For production deployment, ensure all localhost URLs are updated back to production endpoints and credentials are properly secured.