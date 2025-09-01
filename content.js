// Support Assistant content script with auto-detection for Phase 2
console.log("Support Assistant content script loaded.");

// Global variables for auto-detection
let isEnabled = true;
let currentPlatform = 'unknown';
let lastDetectedMessage = '';
let messageCheckInterval = null;

// Initialize the content script
initializeContentScript();

function initializeContentScript() {
  // Detect the current platform
  currentPlatform = detectPlatform();
  console.log(`Detected platform: ${currentPlatform}`);
  
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  
  // Start monitoring for messages if we're on a supported platform
  if (currentPlatform !== 'unknown') {
    startMessageMonitoring();
  }
  
  // Listen for state changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.extensionEnabled) {
      isEnabled = changes.extensionEnabled.newValue;
      console.log("Extension is now:", isEnabled ? "ON" : "OFF");
      
      if (isEnabled && currentPlatform !== 'unknown') {
        startMessageMonitoring();
      } else {
        stopMessageMonitoring();
      }
    }
  });
}

// Function to detect which platform we're on
function detectPlatform() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('zendesk')) return 'zendesk';
  if (hostname.includes('freshdesk')) return 'freshdesk';
  if (hostname.includes('facebook')) return 'facebook';
  if (hostname.includes('hootsuite')) return 'hootsuite';
  if (hostname.includes('freshchat')) return 'freshchat';
  if (hostname.includes('intercom')) return 'intercom';
  
  return 'unknown';
}

// Start monitoring for new customer messages
function startMessageMonitoring() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
  }
  
  console.log(`Starting message monitoring on ${currentPlatform}`);
  
  // Check for messages every 2 seconds
  messageCheckInterval = setInterval(() => {
    if (isEnabled) {
      extractCustomerMessage();
    }
  }, 2000);
  
  // Initial check
  extractCustomerMessage();
}

// Stop monitoring for messages
function stopMessageMonitoring() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
    messageCheckInterval = null;
    console.log("Message monitoring stopped");
  }
}

// Extract the latest customer message from the page
function extractCustomerMessage() {
  if (!isEnabled || currentPlatform === 'unknown') return;
  
  let message = '';
  let messageElement = null;
  
  try {
    switch(currentPlatform) {
      case 'zendesk':
        // Try multiple selectors for Zendesk
        messageElement = document.querySelector('.message-list .message:not(.agent) .message-body, [data-testid*="message"]:not([class*="agent"])');
        if (messageElement) {
          message = messageElement.textContent.trim();
        }
        break;
        
      case 'freshdesk':
        messageElement = document.querySelector('.user-response .response-text, .conversation-body.customer');
        if (messageElement) {
          message = messageElement.textContent.trim();
        }
        break;
        
      case 'facebook':
        messageElement = document.querySelector('[aria-label*="Message"] [dir="ltr"]:not([class*="outgoing"])');
        if (messageElement) {
          message = messageElement.textContent.trim();
        }
        break;
        
      case 'hootsuite':
        messageElement = document.querySelector('.inbound-message .message-content, .message.inbound .text');
        if (messageElement) {
          message = messageElement.textContent.trim();
        }
        break;
        
      case 'freshchat':
        messageElement = document.querySelector('.fc-msg.usr, .message-row.customer .message-text');
        if (messageElement) {
          message = messageElement.textContent.trim();
        }
        break;
        
      case 'intercom':
        messageElement = document.querySelector('.intercom-message-group.customer .intercom-message-content');
        if (messageElement) {
          message = messageElement.textContent.trim();
        }
        break;
    }
    
    // If we found a new message, process it
    if (message && message !== lastDetectedMessage) {
      console.log("New customer message detected:", message);
      lastDetectedMessage = message;
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: "newCustomerMessage",
        message: message,
        platform: currentPlatform
      });
    }
  } catch (error) {
    console.error('Error extracting message:', error);
  }
}

// Handle runtime messages from popup/background
function handleRuntimeMessage(request, sender, sendResponse) {
  if (request.action === "extensionStateChanged") {
    isEnabled = request.enabled;
    console.log("Extension is now:", isEnabled ? "ON" : "OFF");
    
    if (isEnabled && currentPlatform !== 'unknown') {
      startMessageMonitoring();
    } else {
      stopMessageMonitoring();
    }
    
    sendResponse({ success: true });
  }
  
  if (request.action === "getCustomerMessage") {
    const message = extractCustomerMessage();
    sendResponse({ 
      message: lastDetectedMessage, 
      platform: currentPlatform 
    });
  }
  
  if (request.action === "pasteSuggestion") {
    const success = pasteSuggestion(request.text);
    sendResponse({ success: success });
  }
  
  if (request.action === "customerMessageUpdated") {
    // Optional: Handle updates from other tabs
    if (request.message && request.message !== lastDetectedMessage) {
      lastDetectedMessage = request.message;
    }
    sendResponse({ success: true });
  }
  
  return true; // Indicates we wish to send a response asynchronously
}

// Paste suggestion into the chat input
function pasteSuggestion(text) {
  if (!isEnabled || currentPlatform === 'unknown') return false;
  
  try {
    let inputField = null;
    
    switch(currentPlatform) {
      case 'zendesk':
        inputField = document.querySelector('textarea[aria-label*="message"], [data-testid*="message-input"]');
        break;
        
      case 'freshdesk':
        inputField = document.querySelector('.reply-box textarea, .fr-element.fr-view');
        break;
        
      case 'facebook':
        inputField = document.querySelector('[contenteditable="true"][aria-label*="Message"]');
        break;
        
      case 'hootsuite':
        inputField = document.querySelector('.compose-text textarea, .compose-input');
        break;
        
      case 'freshchat':
        inputField = document.querySelector('.fc-msg-box, .message-input textarea');
        break;
        
      case 'intercom':
        inputField = document.querySelector('.intercom-composer-textarea, [contenteditable="true"].composer');
        break;
    }
    
    if (inputField) {
      // For contenteditable divs (like Facebook)
      if (inputField.isContentEditable) {
        inputField.focus();
        document.execCommand('selectAll');
        document.execCommand('delete');
        document.execCommand('insertText', false, text);
      } else {
        // For textareas
        inputField.value = text;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      console.log("Suggestion pasted successfully");
      return true;
    }
  } catch (error) {
    console.error('Error pasting suggestion:', error);
  }
  
  return false;
}

// Utility function to find the best input field
function findInputField(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}
