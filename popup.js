// popup.js

const API_BASE_URL = 'https://growsocial.com.ng/api';

// =============== DOM READY ===============
document.addEventListener('DOMContentLoaded', () => {
    initLogoutHandler();
    initAuthorizeHandler();

    // Check login and fetch subscriptions
    chrome.storage.local.get(['isLoggedIn', 'userEmail'], ({ isLoggedIn, userEmail }) => {
        if (isLoggedIn && userEmail) {
            checkOAuthStatus();
            fetchPotentialSubscriptions(userEmail);
        } else {
            // If not logged in, perhaps show a login prompt or redirect, but for popup, maybe clear or show message
            const container = document.getElementById('potentialSubscriptions');
            if (container) {
                container.innerHTML = '<p class="text-center text-gray-500 py-8">Please log in to view subscriptions.</p>';
            }
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

// =============== FETCH SUBSCRIPTIONS ===============
function fetchPotentialSubscriptions(email) {
    fetch(`${API_BASE_URL}/youtubefetch.php?email=${encodeURIComponent(email)}`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('potentialSubscriptions');
            if (!container) return;

            container.innerHTML = '';

            if (data.status === 'success' && Array.isArray(data.data)) {
                data.data.forEach(sub => {
                    const subEl = createSubscriptionElement(sub);
                    container.appendChild(subEl);
                });
            } else if (data.status === 'empty') {
                container.innerHTML = '<p class="text-center text-gray-500 py-8">No channels available</p>';
            } else {
                container.innerHTML = '<p class="text-center text-red-500 py-8">Unexpected response. Please try again later.</p>';
                console.warn('Unexpected response:', data);
            }
        })
        .catch(err => {
            const container = document.getElementById('potentialSubscriptions');
            if (container) {
                container.innerHTML = '<p class="text-center text-red-500 py-8">Failed to load subscriptions. Please try again later.</p>';
            }
            console.error('Fetch failed:', err);
        });
}

// =============== CREATE SUB ELEMENT ===============
function createSubscriptionElement(sub) {
    const wrapper = document.createElement('div');
    wrapper.className = 'subscription bg-white rounded-lg shadow-md p-4 mb-4 hover:shadow-lg transition-shadow duration-300';

    wrapper.innerHTML = `
        <div class="channel-info flex flex-col gap-2">
            <h3 class="text-lg font-semibold text-gray-800">${sub.channelName}</h3>
            <p class="text-sm text-gray-600">${sub.description}</p>
            <p class="text-sm font-medium text-gray-700">Rate: <span class="text-green-600">${sub.currency}${sub.rate}</span></p>
            <p class="text-sm text-gray-700">Category: <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">${sub.category}</span></p>
        </div>
        <div class="mt-4 flex justify-end">
            <button class="subscribe-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors duration-300 flex items-center gap-2" data-channel-id="${sub.id}">
                <span>Subscribe</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            </button>
        </div>
    `;

    const subscribeBtn = wrapper.querySelector('.subscribe-btn');
    subscribeBtn?.addEventListener('click', () => {
        window.open(sub.channelUrl, '_blank');
        alert(`You are now subscribed to ${sub.channelName}!`);
        chrome.runtime.sendMessage({ action: 'startTracking', channelId: sub.id });
    });

    return wrapper;
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