// This will be used heavily in Phase 2 to read chat messages.
// For now, we just initialize and listen for state changes.

console.log("Support Assistant content script loaded.");

// Listen for state changes from the popup/background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extensionStateChanged") {
    console.log("Extension is now:", request.enabled ? "ON" : "OFF");
    // In Phase 2, this will enable/disable the auto-reading functionality
  }
});