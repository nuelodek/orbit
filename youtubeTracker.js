// Click-based tracking replaced with API polling
// window.addEventListener('click', (e) => {
//     const subscribeBtn = e.target.closest('ytd-subscribe-button-renderer, tp-yt-paper-button');

//     if (subscribeBtn && subscribeBtn.innerText.includes('Subscribe')) {
//         chrome.runtime.sendMessage({
//             action: 'subscribed',
//             url: window.location.href
//         });
//     }
// });

// Listen for confirmation message from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'subscriptionTracked' && message.success) {
        alert("✅ Subscription tracked and confirmed!");
    }
});
