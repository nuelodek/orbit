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

        case 'authenticate':
            initiateOAuth().then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;

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

    chrome.storage.local.get(['userEmail', 'dataConsent'], ({ userEmail, dataConsent }) => {
        if (!userEmail) {
            console.warn('No user email found in storage');
            return;
        }

        if (!dataConsent) {
            console.warn('Data collection consent not granted');
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

    // Basic validation
    if (!email || !password) {
        sendResponse({ success: false, message: 'Email and password are required' });
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        sendResponse({ success: false, message: 'Invalid email format' });
        return;
    }

    if (password.length < 6) {
        sendResponse({ success: false, message: 'Password must be at least 6 characters' });
        return;
    }

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
// =============== OAUTH 2.0 FUNCTIONS ===============

function getAuthToken(interactive = false) {
  console.log(`🔑 Getting auth token, interactive: ${interactive}`);
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Auth token error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log('✅ Auth token obtained');
        resolve(token);
      }
    });
  });
}

// =============== ALARM LISTENER ===============

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollSubscriptions') {
    pollYouTubeSubscriptions();
  }
});

function removeCachedAuthToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({}, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// =============== YOUTUBE API FUNCTIONS ===============

function fetchYouTubeSubscriptions(accessToken) {
  return fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }
    return response.json();
  });
}

function fetchRewardedChannels(userEmail) {
  return fetch('https://growsocial.com.ng/api/get-rewarded-channels.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email: userEmail })
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      return data.channels || [];
    } else {
      throw new Error(data.message || 'Failed to fetch rewarded channels');
    }
  });
}

function compareSubscriptions(subscriptions, rewardedChannels, rewardedSubs) {
  const newRewards = [];
  subscriptions.forEach(sub => {
    const channelId = sub.snippet.resourceId.channelId;
    const isRewarded = rewardedChannels.some(rc => rc.channelId === channelId);
    const alreadyRewarded = rewardedSubs.includes(channelId);
    if (isRewarded && !alreadyRewarded) {
      newRewards.push({
        channelId,
        channelTitle: sub.snippet.title,
        subscribedAt: sub.snippet.publishedAt
      });
    }
  });
  return newRewards;
}

function sendSubscriptionReward(userEmail, channelData) {
  console.log('📤 Sending subscription reward for channel:', channelData.channelId);
  const timestamp = new Date().toISOString();
  return fetch('https://growsocial.com.ng/api/track-subscription.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_email: userEmail,
      event: 'subscribed',
      timestamp,
      url: `https://www.youtube.com/channel/${channelData.channelId}`,
      id: channelData.channelId,
      method: 'api'
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('📥 Reward response:', data);
    return data;
  });
}

// =============== POLLING FUNCTION ===============

async function pollYouTubeSubscriptions() {
  console.log('🔄 Starting subscription poll');
  try {
    const { userEmail, rewardedSubs = [] } = await chrome.storage.local.get(['userEmail', 'rewardedSubs']);
    if (!userEmail) {
      console.log('No user email, skipping poll');
      return;
    }

    console.log('📧 User email:', userEmail);
    const accessToken = await getAuthToken(false);
    const [subscriptionsData, rewardedChannels] = await Promise.all([
      fetchYouTubeSubscriptions(accessToken),
      fetchRewardedChannels(userEmail)
    ]);

    const subscriptions = subscriptionsData.items || [];
    console.log(`📺 Fetched ${subscriptions.length} subscriptions`);
    console.log(`🎁 Fetched ${rewardedChannels.length} rewarded channels`);
    const newRewards = compareSubscriptions(subscriptions, rewardedChannels, rewardedSubs);
    console.log(`🆕 Found ${newRewards.length} new rewards`);

    for (const reward of newRewards) {
      console.log('💰 Sending reward for channel:', reward.channelId);
      await sendSubscriptionReward(userEmail, reward);
      rewardedSubs.push(reward.channelId);
    }

    if (newRewards.length > 0) {
      chrome.storage.local.set({ rewardedSubs });
      console.log(`✅ Rewarded ${newRewards.length} new subscriptions`);
    } else {
      console.log('ℹ️ No new rewards this poll');
    }
  } catch (error) {
    console.error('❌ Polling error:', error);
    if (error.message.includes('OAuth')) {
      console.log('🔄 OAuth error detected, attempting refresh');
      // Token might be invalid, try to refresh
      try {
        await removeCachedAuthToken();
        const newToken = await getAuthToken(true);
        // Retry once
        console.log('🔄 Retrying poll after token refresh');
        pollYouTubeSubscriptions();
      } catch (authError) {
        console.error('❌ Auth refresh failed:', authError);
      }
    }
  }
}

// =============== INITIATE OAUTH ===============

function initiateOAuth() {
  return getAuthToken(true);
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
    chrome.alarms.create('pollSubscriptions', { periodInMinutes: 5 });

    // Automatically inject tracker on YouTube pages
    chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                injectTracker(tab.id);
            }
        });
    });
});
