// Initialize extension state on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    extensionEnabled: true,
    lastCustomerMessage: "",
    detectedPlatform: ""
  });
  
  // Load FAQ data
  fetch(chrome.runtime.getURL('faq.json'))
    .then(response => response.json())
    .then(data => {
      chrome.storage.local.set({ faqData: data });
    })
    .catch(error => {
      console.error('Error loading FAQ data:', error);
    });
});

// Track the current state
let isEnabled = true;
let lastMessage = '';
let currentPlatform = '';

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getExtensionState") {
    // Return the current state
    chrome.storage.local.get(['extensionEnabled'], (result) => {
      sendResponse({ enabled: result.extensionEnabled });
    });
    return true; // Indicates we wish to send a response asynchronously
  }

  if (request.action === "toggleEnabled") {
    isEnabled = request.value;
    chrome.storage.local.set({ extensionEnabled: isEnabled });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "newCustomerMessage") {
    lastMessage = request.message;
    currentPlatform = request.platform;
    
    // Store the message for the popup to access
    chrome.storage.local.set({ 
      lastCustomerMessage: request.message,
      detectedPlatform: request.platform 
    });
    
    // Notify all tabs about the new message (optional)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "customerMessageUpdated",
          message: request.message,
          platform: request.platform
        }).catch(error => {
          // Tab might not have content script, ignore errors
        });
      });
    });
    
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "getStatus") {
    sendResponse({ 
      enabled: isEnabled, 
      lastMessage: lastMessage,
      platform: currentPlatform
    });
    return true;
  }

  if (request.action === "getFAQ") {
    chrome.storage.local.get(['faqData'], (result) => {
      sendResponse({ faqData: result.faqData });
    });
    return true;
  }
});

// Handle extension icon click (optional enhancement)
chrome.action.onClicked.addListener((tab) => {
  // You could implement toggle functionality on icon click
  chrome.storage.local.get(['extensionEnabled'], (result) => {
    const newState = !result.extensionEnabled;
    chrome.storage.local.set({ extensionEnabled: newState });
    
    // Update icon to reflect state (optional)
    const iconPath = newState ? 'icon16.png' : 'icon16-disabled.png';
    chrome.action.setIcon({ path: iconPath });
  });
});

// Track tab changes to detect platform context
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    detectPlatformFromUrl(tab.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      detectPlatformFromUrl(tab.url);
    }
  });
});

function detectPlatformFromUrl(url) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  
  let platform = 'unknown';
  
  if (hostname.includes('zendesk')) platform = 'zendesk';
  else if (hostname.includes('freshdesk')) platform = 'freshdesk';
  else if (hostname.includes('facebook')) platform = 'facebook';
  else if (hostname.includes('hootsuite')) platform = 'hootsuite';
  else if (hostname.includes('freshchat')) platform = 'freshchat';
  else if (hostname.includes('intercom')) platform = 'intercom';
  
  if (platform !== 'unknown') {
    chrome.storage.local.set({ detectedPlatform: platform });
  }
}
