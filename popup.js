// popup.js

const API_BASE_URL = 'https://growsocial.com.ng/api';

// =============== DOM READY ===============
document.addEventListener('DOMContentLoaded', () => {
    initLogoutHandler();
    initAuthorizeHandler();
    initTabHandlers();

    // Check login and fetch data
    chrome.storage.local.get(['isLoggedIn', 'userEmail'], ({ isLoggedIn, userEmail }) => {
        if (isLoggedIn && userEmail) {
            checkOAuthStatus();
            fetchMySubscriptions(userEmail);
            fetchAvailableChannels(userEmail);
            fetchRewards(userEmail);
        } else {
            // If not logged in, show message in all tabs
            showLoginRequiredMessage();
            hideOAuthSection();
        }
    });
});

// =============== LOGOUT HANDLER ===============
function initLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            chrome.runtime.sendMessage({ action: 'logout' }, () => {
                window.location.href = 'popup.html';
            });
        });
    });
}

// =============== AUTHORIZE HANDLER ===============
function initAuthorizeHandler() {
    const authorizeBtn = document.getElementById('authorizeBtn');
    if (!authorizeBtn) return;

    authorizeBtn.addEventListener('click', () => {
        authorizeBtn.disabled = true;
        authorizeBtn.textContent = 'Authorizing...';

        chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
            if (response && response.success) {
                checkOAuthStatus();
            } else {
                authorizeBtn.disabled = false;
                authorizeBtn.textContent = 'Authorize YouTube Access';
                alert('Authorization failed. Please try again.');
            }
        });
    });
}

// =============== TAB HANDLERS ===============
function initTabHandlers() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => {
                t.classList.remove('active', 'bg-gray-700', 'text-white');
                t.classList.add('bg-gray-600', 'text-gray-300');
            });

            // Add active class to clicked tab
            tab.classList.add('active', 'bg-gray-700', 'text-white');
            tab.classList.remove('bg-gray-600', 'text-gray-300');

            // Hide all tab contents
            contents.forEach(content => {
                content.style.display = 'none';
            });

            // Show selected tab content
            const tabId = tab.id.replace('tab-', 'tab-content-');
            const content = document.getElementById(tabId);
            if (content) {
                content.style.display = 'block';
            }
        });
    });
}

// =============== FETCH MY SUBSCRIPTIONS ===============
function fetchMySubscriptions(email) {
    chrome.runtime.sendMessage({ action: 'getMySubscriptions' }, (response) => {
        const container = document.getElementById('mySubscriptions');
        if (!container) return;

        container.innerHTML = '';

        if (response && response.success && Array.isArray(response.subscriptions)) {
            if (response.subscriptions.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 py-8">No subscriptions found. Make sure YouTube access is authorized.</p>';
            } else {
                response.subscriptions.forEach(sub => {
                    const subEl = createMySubscriptionElement(sub);
                    container.appendChild(subEl);
                });
            }
            // Update tab title with count
            updateTabTitle('tab-subscriptions', 'My Subscriptions', response.subscriptions.length);
        } else {
            container.innerHTML = '<p class="text-center text-red-500 py-8">Failed to load subscriptions. Please check YouTube authorization.</p>';
            updateTabTitle('tab-subscriptions', 'My Subscriptions', 0);
        }
    });
}

// =============== FETCH AVAILABLE CHANNELS ===============
function fetchAvailableChannels(email) {
    fetch(`${API_BASE_URL}/fetch_subscriptions.php?action=get_available_channels`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('availableChannels');
            if (!container) return;

            container.innerHTML = '';

            if (data.success && Array.isArray(data.subscriptions)) {
                if (data.subscriptions.length === 0) {
                    container.innerHTML = '<p class="text-center text-gray-500 py-8">No channels available</p>';
                    updateTabTitle('tab-available', 'Available Channels', 0);
                } else {
                    data.subscriptions.forEach(sub => {
                        const subEl = createAvailableChannelElement(sub);
                        container.appendChild(subEl);
                    });
                    updateTabTitle('tab-available', 'Available Channels', data.subscriptions.length);
                }
            } else {
                container.innerHTML = '<p class="text-center text-red-500 py-8">Failed to load channels. Please try again later.</p>';
                console.warn('Unexpected response:', data);
                updateTabTitle('tab-available', 'Available Channels', 0);
            }
        })
        .catch(err => {
            const container = document.getElementById('availableChannels');
            if (container) {
                container.innerHTML = '<p class="text-center text-red-500 py-8">Failed to load channels. Please try again later.</p>';
            }
            console.error('Fetch failed:', err);
            updateTabTitle('tab-available', 'Available Channels', 0);
        });
}

// =============== FETCH REWARDS ===============
function fetchRewards(email) {
    fetch(`${API_BASE_URL}/fetch_subscriptions.php?action=get_user_rewards&email=${encodeURIComponent(email)}`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('rewardsContent');
            if (!container) return;

            container.innerHTML = '';

            if (data.status === 'success' && Array.isArray(data.rewards)) {
                if (data.rewards.length === 0) {
                    container.innerHTML = '<p class="text-center text-gray-500 py-8">You have not performed any subscriptions yet.</p>';
                    updateTabTitle('tab-rewards', 'Rewards', 0);
                } else {
                    const totalRewards = data.rewards.reduce((sum, reward) => sum + parseFloat(reward.amount), 0);
                    const summaryEl = document.createElement('div');
                    summaryEl.className = 'bg-green-100 border border-green-300 rounded-lg p-4 mb-4';
                    summaryEl.innerHTML = `
                        <h3 class="text-green-800 font-semibold text-lg">Total Rewards: ${data.currency || '$'}${totalRewards.toFixed(2)}</h3>
                        <p class="text-green-600 text-sm">Keep subscribing to earn more!</p>
                    `;
                    container.appendChild(summaryEl);

                    data.rewards.forEach(reward => {
                        const rewardEl = createRewardElement(reward);
                        container.appendChild(rewardEl);
                    });
                    updateTabTitle('tab-rewards', 'Rewards', data.rewards.length);
                }
            } else {
                container.innerHTML = '<p class="text-center text-red-500 py-8">Failed to load rewards. Please try again later.</p>';
                console.warn('Unexpected response:', data);
                updateTabTitle('tab-rewards', 'Rewards', 0);
            }
        })
        .catch(err => {
            const container = document.getElementById('rewardsContent');
            if (container) {
                container.innerHTML = '<p class="text-center text-red-500 py-8">Failed to load rewards. Please try again later.</p>';
            }
            console.error('Fetch failed:', err);
            updateTabTitle('tab-rewards', 'Rewards', 0);
        });
}

// =============== CREATE MY SUBSCRIPTION ELEMENT ===============
function createMySubscriptionElement(sub) {
    const wrapper = document.createElement('div');
    wrapper.className = 'subscription bg-gray-700 rounded-lg p-4 mb-3 border border-gray-600';

    const subscribedDate = new Date(sub.subscribedAt || Date.now()).toLocaleDateString();

    wrapper.innerHTML = `
        <div class="channel-info flex items-center gap-3">
            <img src="${sub.thumbnails?.default?.url || 'https://via.placeholder.com/40'}" alt="${sub.title}" class="w-10 h-10 rounded-full">
            <div class="flex-1">
                <h3 class="text-white font-semibold text-sm">${sub.title || sub.channelTitle}</h3>
                <p class="text-gray-400 text-xs">Subscribed: ${subscribedDate}</p>
            </div>
            <div class="text-right">
                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
        </div>
    `;

    return wrapper;
}

// =============== CREATE AVAILABLE CHANNEL ELEMENT ===============
function createAvailableChannelElement(sub) {
    const wrapper = document.createElement('div');
    wrapper.className = 'subscription bg-gray-700 rounded-lg p-4 mb-3 border border-gray-600';

    const uploadDate = new Date(sub.upload_date || Date.now()).toLocaleDateString();

    wrapper.innerHTML = `
        <div class="channel-info flex items-center gap-3">
            <img src="https://via.placeholder.com/40x40/374151/9CA3AF?text=${sub.channel_name.charAt(0)}" alt="${sub.channel_name}" class="w-10 h-10 rounded-full bg-gray-600">
            <div class="flex-1">
                <h3 class="text-white font-semibold text-sm">${sub.channel_name}</h3>
                <p class="text-gray-400 text-xs"><span class="text-white">Reward: ${sub.currency}${sub.rate}</span> • ${sub.category}</p>
                <p class="text-gray-400 text-xs">Uploaded: ${uploadDate}</p>
            </div>
            <div class="text-right">
                <button class="subscribe-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs transition-colors duration-300 flex items-center gap-1" data-channel-id="${sub.id}" data-poster-email="${sub.poster_email}" data-rate="${sub.rate}" data-currency="${sub.currency}">
                    <span>Subscribe</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </button>
            </div>
        </div>
    `;

    const subscribeBtn = wrapper.querySelector('.subscribe-btn');
    subscribeBtn?.addEventListener('click', () => {
        window.open(sub.channel_url, '_blank');
        alert(`You are now subscribed to ${sub.channel_name}!`);
        chrome.runtime.sendMessage({
            action: 'startTracking',
            channelId: sub.id,
            subscriptionId: sub.id,
            posterEmail: sub.poster_email,
            rate: sub.rate,
            currency: sub.currency
        });
    });

    return wrapper;
}

// =============== CREATE REWARD ELEMENT ===============
function createRewardElement(reward) {
    const wrapper = document.createElement('div');
    wrapper.className = 'reward bg-gray-700 rounded-lg p-4 mb-3 border border-gray-600';

    const earnedDate = new Date(reward.earned_at || reward.timestamp).toLocaleDateString();

    wrapper.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-white font-semibold text-sm">${reward.channel_name || 'Channel Subscription'}</h3>
                    <p class="text-gray-400 text-xs">Earned: ${earnedDate}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-green-400 font-bold text-lg">${reward.currency || '$'}${reward.amount}</p>
            </div>
        </div>
    `;

    return wrapper;
}

// =============== SHOW LOGIN REQUIRED MESSAGE ===============
function showLoginRequiredMessage() {
    const containers = ['mySubscriptions', 'availableChannels', 'rewardsContent'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Please log in to view this content.</p>';
        }
    });
}

// =============== OAUTH STATUS CHECK ===============
function checkOAuthStatus() {
    console.log('🔍 Checking OAuth status');
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError || !token) {
            console.log('❌ OAuth not authorized:', chrome.runtime.lastError);
            showOAuthNotAuthorized();
        } else {
            console.log('✅ OAuth authorized');
            showOAuthAuthorized();
        }
    });
}

function showOAuthAuthorized() {
    const authorizedDiv = document.getElementById('oauthAuthorized');
    const notAuthorizedDiv = document.getElementById('oauthNotAuthorized');
    if (authorizedDiv) authorizedDiv.classList.remove('hidden');
    if (notAuthorizedDiv) notAuthorizedDiv.classList.add('hidden');
}

function showOAuthNotAuthorized() {
    const authorizedDiv = document.getElementById('oauthAuthorized');
    const notAuthorizedDiv = document.getElementById('oauthNotAuthorized');
    if (authorizedDiv) authorizedDiv.classList.add('hidden');
    if (notAuthorizedDiv) notAuthorizedDiv.classList.remove('hidden');
}

function hideOAuthSection() {
    const section = document.getElementById('oauthSection');
    if (section) section.style.display = 'none';
}

// =============== UPDATE TAB TITLE WITH COUNT ===============
function updateTabTitle(tabId, baseTitle, count) {
    const tab = document.getElementById(tabId);
    if (tab) {
        if (count > 0) {
            tab.textContent = `${baseTitle}(${count})`;
        } else {
            tab.textContent = baseTitle;
        }
    }
}