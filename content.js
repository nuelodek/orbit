// content.js

const API_BASE_URL = 'https://growsocial.com.ng/api';

// =============== DOM READY ===============
document.addEventListener('DOMContentLoaded', () => {
    initLoginCheck();
    initLoginHandler();
    initLogoutHandler();
    addFooter();
});

// =============== LOGIN CHECK ===============
function initLoginCheck() {
    chrome.storage.local.get(['isLoggedIn', 'userEmail'], ({ isLoggedIn, userEmail }) => {
        if (isLoggedIn && userEmail) {
            fetchPotentialSubscriptions(userEmail);
        } else {
            // Check if we're already on the login page to prevent redirect loop
            if (!window.location.href.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }
    });
}

// =============== LOGIN HANDLER ===============
function initLoginHandler() {
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;

    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email')?.value.trim();
        const password = document.getElementById('password')?.value.trim();
        const status = document.getElementById('status');

        if (!email || !password) {
            if (status) status.textContent = 'Please fill all fields.';
            return;
        }

        // Disable login button while processing
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'login',
                    data: { email, password }
                }, resolve);
            });

            if (response.success) {
                await new Promise((resolve) => {
                    chrome.storage.local.set({ isLoggedIn: true, userEmail: email }, resolve);
                });
                window.location.href = 'popup.html';
            } else {
                if (status) status.textContent = response.message || 'Login failed.';
                // Re-enable login button
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        } catch (error) {
            if (status) status.textContent = 'Connection error. Please try again.';
            // Re-enable login button
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });
}

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

// =============== FOOTER ===============
function addFooter() {
    const footer = document.createElement('footer');
    footer.className = 'fixed bottom-0 w-full py-4 mt-[20px] bg-gray-800 text-white flex justify-center items-center border-t border-gray-700';

    const p = document.createElement('p');
    p.className = 'text-gray-500 text-xs text-center';

    const currentYear = new Date().getFullYear();
    const link = document.createElement('a');
    link.href = 'https://growsocial.com.ng';
    link.className = 'text-blue-600 hover:text-indigo-600';
    link.textContent = 'GrowSocial.com.ng';

    p.innerHTML = `© ${currentYear} Orbit by `;
    p.appendChild(link);

    footer.appendChild(p);
    document.body.appendChild(footer);
}
