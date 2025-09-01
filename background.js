// Initialize extension state on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ extensionEnabled: true });
});

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getExtensionState") {
    // Return the current state
    chrome.storage.local.get(['extensionEnabled'], (result) => {
      sendResponse({ enabled: result.extensionEnabled });
    });
    return true; // Indicates we wish to send a response asynchronously
  }
});