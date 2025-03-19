// Background script for FactCheck Assistant

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('FactCheck Assistant extension installed');
});

// Inject content script when a tab is updated and has completed loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    console.log('Tab loaded, injecting content script:', tab.url);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      console.log('Content script injected successfully');
      // Send a message to initialize the floating button
      chrome.tabs.sendMessage(tabId, { action: 'initialize' });
    }).catch(err => {
      console.error('Error injecting content script:', err);
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle any background tasks here if needed
  return true; // Required for async response
});
