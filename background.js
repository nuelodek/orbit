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

        case 'getMySubscriptions':
            handleGetMySubscriptions(sendResponse);
            return true;

        case 'getYouTubeAccountInfo':
            handleGetYouTubeAccountInfo(sendResponse);
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
            // Wait for YouTube tab to finish loading with timeout
            let listenerAdded = false;
            const listener = (tabId, changeInfo, updatedTab) => {
                if (tabId === tab.id && changeInfo.status === 'complete' && updatedTab.url?.includes('youtube.com')) {
                    chrome.tabs.onUpdated.removeListener(listener);
                    listenerAdded = false;
                    injectTracker(tabId);
                }
            };

            // Add listener with cleanup timeout
            chrome.tabs.onUpdated.addListener(listener);
            listenerAdded = true;

            // Remove listener after 30 seconds to prevent accumulation
            setTimeout(() => {
                if (listenerAdded) {
                    chrome.tabs.onUpdated.removeListener(listener);
                    listenerAdded = false;
                    console.log('⏱️ Removed stale tab listener');
                }
            }, 30000);
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

        // First, get YouTube subscription data to verify
        getAuthToken(false).then(accessToken => {
            return fetchYouTubeSubscriptions(accessToken);
        }).then(youtubeData => {
            const subscriptions = youtubeData.items || [];
            const channelId = message.channelId;

            // Check if user is actually subscribed to this channel
            const isSubscribed = subscriptions.some(sub => sub.snippet.resourceId.channelId === channelId);

            if (isSubscribed) {
                // Get user's YouTube account info
                return fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                })
                .then(response => response.json())
                .then(channelData => {
                    const youtubeAccount = channelData.items?.[0]?.snippet?.title || '';

                    // Send to custom endpoint for tracking
                    fetch('https://growsocial.com.ng/api/fetch_subscriptions.php?action=track_subscription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_email: userEmail,
                            subscription_id: message.subscriptionId,
                            poster_email: message.posterEmail,
                            rate: message.rate,
                            currency: message.currency,
                            youtube_account: youtubeAccount
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && sender.tab?.id) {
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
            } else {
                console.warn('User is not actually subscribed to this channel on YouTube');
            }
        }).catch(error => {
            console.error('Failed to verify YouTube subscription:', error);
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
    .then(response => {
        console.log('Login response status:', response.status);
        if (!response.ok) {
            throw new Error(`Login HTTP error: ${response.status}`);
        }
        return response.text(); // Get as text first to debug
    })
    .then(text => {
        console.log('Login response text:', text);
        if (!text || text.trim() === '') {
            sendResponse({ success: false, message: 'Empty response from login server' });
            throw new Error('Empty login response');
        }
        try {
            const data = JSON.parse(text);
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
        } catch (parseError) {
            console.error('JSON parse error for login:', parseError, 'Response text:', text);
            sendResponse({ success: false, message: 'Invalid response from server' });
            throw new Error('JSON parse error');
        }
    })
    .then(profileResponse => {
        if (!profileResponse.ok) {
            throw new Error(`Profile fetch error: ${profileResponse.status}`);
        }
        return profileResponse.json();
    })
    .then(profileResponse => {
        console.log('Profile response type:', typeof profileResponse, 'has status:', 'status' in profileResponse);
        if (profileResponse && typeof profileResponse === 'object' && 'status' in profileResponse) {
            console.log('Profile response is already parsed JSON');
            return profileResponse;
        }
        console.log('Profile response needs parsing, status:', profileResponse.status, 'ok:', profileResponse.ok);
        if (!profileResponse.ok) {
            throw new Error(`Profile fetch error: ${profileResponse.status}`);
        }
        return profileResponse.json(); // Parse as JSON
    })
    .then(profileData => {
        if (profileData.success && profileData.user_data) {
            // Check if user has Google OAuth tokens stored
            return fetch(`https://growsocial.com.ng/api/get_google_tokens.php?user_email=${encodeURIComponent(email)}`)
                .then(tokenResponse => {
                    if (!tokenResponse.ok) {
                        console.log('⚠️ Token check failed, proceeding without tokens');
                        return { success: false };
                    }
                    return tokenResponse.json();
                })
                .then(tokenData => {
                    console.log('🔍 Google tokens check result:', tokenData);
                    return { profileData, tokenData };
                })
                .catch(tokenError => {
                    console.log('⚠️ Could not fetch Google tokens, proceeding without them:', tokenError);
                    return { profileData, tokenData: { success: false } };
                });
        } else {
            throw new Error(profileData.message || 'Failed to fetch profile data');
        }
    })
    .then(({ profileData, tokenData }) => {
        // Clear any existing OAuth tokens for this user session
        chrome.identity.clearAllCachedAuthTokens(() => {
            const storageData = {
                orbitUser: profileData.user_data,
                isLoggedIn: true,
                userEmail: profileData.user_data.email,
                // Clear YouTube-specific data for new user
                rewardedSubs: []
            };

            // Store token data for reference (but don't store actual tokens locally)
            if (tokenData.success && tokenData.data && tokenData.data.google_account_linked) {
                storageData.hasGoogleTokens = true;
                storageData.youtubeChannelName = tokenData.data.youtube_channel_name;
                console.log('📋 User has stored Google tokens:', email, '- Channel:', tokenData.data.youtube_channel_name);
            } else {
                storageData.hasGoogleTokens = false;
                console.log('📋 No stored Google tokens found for user:', email);
            }

            chrome.storage.local.set(storageData, () => {
                sendResponse({
                    success: true,
                    userId: profileData.user_data.id,
                    userData: profileData.user_data,
                    hasGoogleTokens: !!(tokenData.success && tokenData.data)
                });
            });
        });
    })
    .catch(error => {
        console.error('Login/Profile error:', error);
        sendResponse({ success: false, message: error.message || 'Login process failed' });
    });
}

// =============== HANDLE: Logout ===============
function handleLogout() {
    // Clear all cached OAuth tokens
    chrome.identity.clearAllCachedAuthTokens(() => {
        // Clear extension storage (this removes local tokens but database tokens persist)
        chrome.storage.local.clear(() => {
            chrome.action.setPopup({ popup: 'login.html' });
            // NOTE: window.close() does NOT work in background scripts
            console.log('🔒 Logged out, OAuth tokens cleared, and local storage cleared.');
            // Database tokens remain for next login
            // Send response back to popup to trigger redirect
            chrome.runtime.sendMessage({ action: 'logoutComplete' });
        });
    });
}

// =============== HANDLE: Get My Subscriptions ===============
function handleGetMySubscriptions(sendResponse) {
    // Check if user has linked Google account first
    chrome.storage.local.get(['userEmail'], ({ userEmail }) => {
        if (!userEmail) {
            sendResponse({ success: false, error: 'No user logged in' });
            return;
        }

        // Check database for Google tokens
        fetch(`https://growsocial.com.ng/api/get_google_tokens.php?user_email=${encodeURIComponent(userEmail)}`)
            .then(response => response.json())
            .then(tokenData => {
                if (tokenData.success && tokenData.data && tokenData.data.google_account_linked && tokenData.data.token_valid) {
                    // User has valid linked account, get subscriptions
                    getAuthToken(false).then(accessToken => {
                        return fetchYouTubeSubscriptions(accessToken);
                    }).then(data => {
                        const subscriptions = data.items || [];
                        // Transform to a simpler format for the popup
                        const formattedSubscriptions = subscriptions.map(sub => ({
                            channelId: sub.snippet.resourceId.channelId,
                            title: sub.snippet.title,
                            description: sub.snippet.description,
                            subscribedAt: sub.snippet.publishedAt,
                            thumbnails: sub.snippet.thumbnails
                        }));
                        sendResponse({ success: true, subscriptions: formattedSubscriptions });
                    }).catch(error => {
                        console.error('Failed to get subscriptions:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                } else {
                    // User hasn't linked Google account
                    sendResponse({ success: false, error: 'YouTube account not linked. Please link your YouTube account first.' });
                }
            })
            .catch(error => {
                console.error('Failed to check Google tokens:', error);
                sendResponse({ success: false, error: 'Failed to verify account status' });
            });
    });
}

// =============== HANDLE: Get YouTube Account Info ===============
function handleGetYouTubeAccountInfo(sendResponse) {
    getAuthToken(false).then(accessToken => {
        return Promise.race([
            fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Account info timeout')), 8000)
            )
        ]);
    }).then(response => {
        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }
        return response.json();
    }).then(data => {
        const accountName = data.items?.[0]?.snippet?.title || 'Unknown Account';
        sendResponse({ success: true, accountName });
    }).catch(error => {
        console.error('Failed to get YouTube account info:', error);
        sendResponse({ success: false, error: error.message });
    });
}
// =============== OAUTH 2.0 FUNCTIONS ===============

function getAuthToken(interactive = false) {
  console.log(`🔑 Getting auth token, interactive: ${interactive}`);
  return new Promise((resolve, reject) => {
    // For non-interactive requests, NEVER use cached Chrome tokens
    // Always check database first, and only use Chrome OAuth for interactive requests
    chrome.storage.local.get(['userEmail'], ({ userEmail }) => {
      if (!interactive && userEmail) {
        // Try to get stored token from database first
        fetch(`https://growsocial.com.ng/api/get_google_tokens.php?user_email=${encodeURIComponent(userEmail)}`)
          .then(response => response.json())
          .then(tokenData => {
            if (tokenData.success && tokenData.data && tokenData.data.google_access_token && tokenData.data.token_valid) {
              console.log('✅ Using stored database token for user:', userEmail);
              resolve(tokenData.data.google_access_token);
              return;
            } else {
              // No valid stored token - reject rather than use Chrome cache
              console.log('❌ No valid stored token for user:', userEmail);
              reject(new Error('No valid stored Google token'));
              return;
            }
          })
          .catch(error => {
            console.log('⚠️ Could not fetch stored token:', error);
            reject(new Error('Could not fetch stored token'));
          });
      } else if (interactive) {
        // For interactive requests, use Chrome OAuth
        getChromeAuthToken(interactive, resolve, reject);
      } else {
        // Non-interactive request without user email
        reject(new Error('No user email for token request'));
      }
    });
  });
}

function getChromeAuthToken(interactive, resolve, reject) {
  const timeout = setTimeout(() => {
    reject(new Error('Auth token request timeout'));
  }, interactive ? 30000 : 10000);

  chrome.identity.getAuthToken({ interactive }, (token) => {
    clearTimeout(timeout);
    if (chrome.runtime.lastError) {
      console.error('❌ Auth token error:', chrome.runtime.lastError);
      reject(chrome.runtime.lastError);
    } else {
      console.log('✅ Auth token obtained from Chrome');

      // If this is an interactive request (user just authorized), store the token
      if (interactive) {
        chrome.storage.local.get(['userEmail'], ({ userEmail }) => {
          if (userEmail) {
            // Store this fresh token in database
            storeFreshToken(token, userEmail);
          }
          resolve(token);
        });
      } else {
        resolve(token);
      }
    }
  });
}

function storeFreshToken(token, userEmail) {
  // Get channel info and store token
  Promise.all([
    fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(response => response.json()),
    new Promise(resolve => {
      const expiryDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      resolve(expiryDate);
    })
  ]).then(([channelData, expiryDate]) => {
    const channelId = channelData.items?.[0]?.id;
    const channelName = channelData.items?.[0]?.snippet?.title;

    fetch('https://growsocial.com.ng/api/update_google_tokens.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_email: userEmail,
        google_access_token: token,
        google_token_expiry: expiryDate,
        youtube_channel_id: channelId,
        youtube_channel_name: channelName,
        google_account_email: userEmail
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('✅ Fresh Google token stored in database for user:', userEmail);
        chrome.storage.local.set({
          hasGoogleTokens: true,
          youtubeChannelName: channelName
        });
      }
    })
    .catch(error => {
      console.error('❌ Failed to store fresh token:', error);
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
  return Promise.race([
    fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('YouTube API timeout')), 10000)
    )
  ])
  .then(response => {
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }
    return response.json();
  });
}

function fetchRewardedChannels(userEmail) {
  return Promise.race([
    fetch('https://growsocial.com.ng/api/fetch_subscriptions.php?action=get_rewarded_channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `user_email=${encodeURIComponent(userEmail)}`
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Server API timeout')), 8000)
    )
  ])
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
  return Promise.race([
    fetch('https://growsocial.com.ng/api/track-subscription.php', {
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
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Reward API timeout')), 6000)
    )
  ])
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

  const { userEmail, rewardedSubs = [] } = await chrome.storage.local.get(['userEmail', 'rewardedSubs']);
  if (!userEmail) {
    console.log('No user email, skipping poll');
    return;
  }

  // Only poll if user has linked their Google account
  try {
    const tokenCheck = await fetch(`https://growsocial.com.ng/api/get_google_tokens.php?user_email=${encodeURIComponent(userEmail)}`)
      .then(response => response.json());

    if (!tokenCheck.success || !tokenCheck.data || !tokenCheck.data.google_account_linked) {
      console.log('⏭️ User has not linked Google account, skipping poll');
      return;
    }

    if (!tokenCheck.data.token_valid) {
      console.log('⏭️ User token expired, skipping poll until refresh');
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

    // Process rewards with timeout protection
    for (const reward of newRewards) {
      try {
        console.log('💰 Sending reward for channel:', reward.channelId);
        await Promise.race([
          sendSubscriptionReward(userEmail, reward),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Reward timeout')), 8000)
          )
        ]);
        rewardedSubs.push(reward.channelId);
      } catch (rewardError) {
        console.error('❌ Failed to send reward for channel:', reward.channelId, rewardError);
        // Continue with other rewards even if one fails
      }
    }

    if (newRewards.length > 0) {
      chrome.storage.local.set({ rewardedSubs });
      console.log(`✅ Rewarded ${newRewards.length} new subscriptions`);
    } else {
      console.log('ℹ️ No new rewards this poll');
    }

  } catch (error) {
    console.error('❌ Polling error:', error);

    // If it's an auth error, user needs to re-link their account
    if (error.message.includes('No valid stored Google token')) {
      console.log('🔄 Token invalid, user needs to re-link Google account');
      // Could trigger a notification here if needed
    }
  }
}

// =============== INITIATE OAUTH ===============

function initiateOAuth() {
  return getAuthToken(true).then(accessToken => {
    // After successful OAuth, get user info and store tokens
    return Promise.all([
      // Get YouTube channel info
      fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).then(response => response.json()),

      // Get token expiry info (approximate)
      new Promise(resolve => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          // Estimate expiry as 1 hour from now (Google tokens typically last 1 hour)
          const expiryDate = new Date(Date.now() + 3600000).toISOString();
          resolve(expiryDate);
        });
      })
    ]).then(([channelData, expiryDate]) => {
      const channelId = channelData.items?.[0]?.id;
      const channelName = channelData.items?.[0]?.snippet?.title;

      // Get current user email
      return new Promise(resolve => {
        chrome.storage.local.get(['userEmail'], ({ userEmail }) => {
          if (userEmail) {
            // Store Google tokens in database only (not local storage)
            fetch('https://growsocial.com.ng/api/update_google_tokens.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_email: userEmail,
                google_access_token: accessToken,
                google_token_expiry: expiryDate,
                youtube_channel_id: channelId,
                youtube_channel_name: channelName,
                google_account_email: userEmail
              })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                console.log('✅ Google tokens stored in database for user:', userEmail);
                // Update local storage to indicate tokens are available
                chrome.storage.local.set({
                  hasGoogleTokens: true,
                  youtubeChannelName: channelName
                });
              } else {
                console.error('❌ Failed to store Google tokens in database');
              }
            })
            .catch(error => {
              console.error('❌ Failed to store Google tokens:', error);
            });
          }
          resolve(accessToken);
        });
      });
    });
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