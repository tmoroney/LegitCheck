document.addEventListener('DOMContentLoaded', function() {
  // Get references to UI elements
  const checkFactsButton = document.getElementById('checkFacts');
  const clearHighlightsButton = document.getElementById('clearHighlights');
  const statusDiv = document.getElementById('status');
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');

  // Load saved API key if available
  chrome.storage.sync.get(['openaiApiKey'], function(result) {
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }
  });

  // Save API key
  saveApiKeyButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({openaiApiKey: apiKey}, function() {
        statusDiv.textContent = 'API key saved successfully!';
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
      });
    } else {
      statusDiv.textContent = 'Please enter a valid API key';
    }
  });

  // Check facts button click handler
  checkFactsButton.addEventListener('click', function() {
    chrome.storage.sync.get(['openaiApiKey'], function(result) {
      if (!result.openaiApiKey) {
        statusDiv.textContent = 'Please enter your OpenAI API key first';
        return;
      }

      statusDiv.textContent = 'Checking facts...';
      
      // First inject the content script to ensure it's loaded
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const activeTab = tabs[0];
        // Inject the content script if it's not already there
        chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          files: ['content.js']
        }, function() {
          // After ensuring the content script is loaded, send the message
          chrome.tabs.sendMessage(activeTab.id, {action: 'checkFacts', apiKey: result.openaiApiKey}, function(response) {
            if (chrome.runtime.lastError) {
              statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
            } else if (response && response.status === 'started') {
              statusDiv.textContent = 'Fact checking in progress...';
            } else {
              statusDiv.textContent = 'Error starting fact check';
            }
          });
        });
      });
    });
  });

  // Clear highlights button click handler
  clearHighlightsButton.addEventListener('click', function() {
    statusDiv.textContent = 'Clearing highlights...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      // Inject the content script if it's not already there
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        files: ['content.js']
      }, function() {
        // After ensuring the content script is loaded, send the message
        chrome.tabs.sendMessage(activeTab.id, {action: 'clearHighlights'}, function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
          } else if (response && response.status === 'cleared') {
            statusDiv.textContent = 'Highlights cleared';
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
          } else {
            statusDiv.textContent = 'Error clearing highlights';
          }
        });
      });
    });
  });
});
