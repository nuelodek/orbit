// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'startTracking':
            handleStartTracking();
            break;

        case 'subscribed':
            handleSubscribed(message, sender);
            break;

        case 'login':
            handleLogin(message, sendResponse);
            return true; // keep sendResponse alive for async

        case 'logout':
            handleLogout();
            break;

        default:
            console.warn(`Unknown message action: ${message.action}`);
            break;
    }
});

// =============== HANDLE: Start Tracking ===============
function handleStartTracking() {
    console.log('🚀 Starting YouTube subscription tracking...');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) return;

        // If already on YouTube and loaded
        if (tab.url?.includes('youtube.com') && tab.status === 'complete') {
            injectTracker(tab.id);
        } else {
            // Wait for YouTube tab to finish loading
            const listener = (tabId, changeInfo, updatedTab) => {
                if (tabId === tab.id && changeInfo.status === 'complete' && updatedTab.url?.includes('youtube.com')) {
                    chrome.tabs.onUpdated.removeListener(listener);
                    injectTracker(tabId);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        }
    });
}

// =============== HANDLE: Subscribed Event ===============
function handleSubscribed(message, sender) {
    console.log("🛰️ Subscription confirmed!");

    const timestamp = new Date().toISOString();

    chrome.storage.local.get('userEmail', ({ userEmail }) => {
        if (!userEmail) {
            console.warn('No userEmail found in chrome.storage.local');
            return;
        }

        fetch('https://growsocial.com.ng/api/track-subscription.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_email: userEmail,
                event: 'subscribed',
                timestamp,
                url: message.url,
                id: message.channelId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && sender.tab?.id) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'subscriptionTracked',
                    success: true
                });
            }
        })
        .catch(error => {
            console.error('Tracking error:', error);
        });
    });
}

// =============== HANDLE: Login ===============
function handleLogin(message, sendResponse) {
    const { email, password } = message.data;

    fetch('https://growsocial.com.ng/growlogin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginemail: email, loginpassword: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Fetch full profile
            return fetch('https://growsocial.com.ng/api/fetchprofile.php', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
        } else {
            sendResponse({ success: false, message: data.message || 'Login failed' });
            throw new Error('Login failed');
        }
    })
    .then(profileResponse => {
        if (!profileResponse.ok) {
            throw new Error(`Profile fetch error: ${profileResponse.status}`);
        }
        return profileResponse.json();
    })
    .then(profileData => {
        if (profileData.success && profileData.user_data) {
            chrome.storage.local.set({
                orbitUser: profileData.user_data,
                isLoggedIn: true,
                userEmail: profileData.user_data.email
            }, () => {
                sendResponse({
                    success: true,
                    userId: profileData.user_data.id,
                    userData: profileData.user_data
                });
            });
        } else {
            throw new Error(profileData.message || 'Failed to fetch profile data');
        }
    })
    .catch(error => {
        console.error('Login/Profile error:', error);
        sendResponse({ success: false, message: error.message || 'Login process failed' });
    });
}

// =============== HANDLE: Logout ===============
function handleLogout() {
    chrome.storage.local.clear(() => {
        chrome.action.setPopup({ popup: 'login.html' });
        // NOTE: window.close() does NOT work in background scripts
        console.log('🔒 Logged out and storage cleared.');
    });
}

// =============== HELPER: Inject YouTube Tracker ===============
function injectTracker(tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        files: ['youtubeTracker.js']
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('❌ Script injection failed:', chrome.runtime.lastError.message);
        } else {
            console.log('✅ youtubeTracker.js injected successfully');
        }
    });
}
// =============== INITIALIZE TRACKER ON YOUTUBE ===============
chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 YouTube Tracker initialized');
    chrome.action.setPopup({ popup: 'popup.html' });

    // Automatically inject tracker on YouTube pages
    chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                injectTracker(tab.id);
            }
        });
    });
});
