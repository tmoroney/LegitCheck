// Global variables to store highlighted elements and their data
let highlightedElements = [];
let isFactCheckInProgress = false;
let floatingButton = null;
let spinner = null;

// Initialize when the content script is loaded
initialize();

// Function to initialize the content script
function initialize() {
  console.log('Content script initialized');
  // Check if we're on a news article and add the floating button
  if (isNewsArticle()) {
    console.log('News article detected, adding floating button');
    createFloatingButton();
  } else {
    console.log('Not a news article, skipping floating button');
  }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Message received in content script:', request.action);

  if (request.action === 'initialize') {
    console.log('Received initialize message');
    initialize();
    sendResponse({ status: 'initialized' });
  } else if (request.action === 'checkFacts') {
    console.log('Received checkFacts message with API key length:', request.apiKey ? request.apiKey.length : 0);
    startFactCheck(request.apiKey);
    sendResponse({ status: 'started' });
  } else if (request.action === 'clearHighlights') {
    clearAllHighlights();
    sendResponse({ status: 'cleared' });
  }
  return true; // Required for async response
});

function isNewsArticle() {
  console.log('Checking if page is a news article...');

  // Hide fact-check button on search engines like Google and Bing
  const searchEngines = ['google', 'bing', 'yahoo', 'yandex', 'baidu', 'sogou', 'duckduckgo', 'brave'];
  if (searchEngines.some(engine => window.location.hostname.toLowerCase().includes(engine))) {
    console.log('Search engine detected, skipping floating button');
    return false;
  }

  // For testing purposes, you might want to always return true
  // return true;

  // Uncomment and adjust the following code for production detection:
  /*
  // Check for common news article indicators
  const hasArticleTag = document.querySelector('article') !== null;
  const hasNewsKeywords = document.querySelector('meta[name="keywords"]')?.content?.toLowerCase().includes('news');
  const hasNewsInUrl = window.location.hostname.includes('news') || 
                      window.location.hostname.includes('times') || 
                      window.location.hostname.includes('post') ||
                      window.location.hostname.includes('tribune') ||
                      window.location.hostname.includes('guardian') ||
                      window.location.hostname.includes('nyt') ||
                      window.location.hostname.includes('bbc') ||
                      window.location.hostname.includes('cnn') ||
                      window.location.hostname.includes('fox');
  
  // Check for article structure (title + multiple paragraphs)
  const hasTitle = document.querySelector('h1') !== null;
  const hasParagraphs = document.querySelectorAll('p').length > 5;
  
  // Return true if multiple indicators are present
  return (hasArticleTag || hasNewsKeywords || hasNewsInUrl) && hasTitle && hasParagraphs;
  */

  // For now, if not a search engine, assume it's a news article:
  return true;
}

// Create and add the floating button to the page
function createFloatingButton() {
  console.log('Creating floating button...');
  if (floatingButton) {
    console.log('Button already exists');
    return; // Button already exists
  }

  // Create button container
  floatingButton = document.createElement('div');
  floatingButton.className = 'fact-check-floating-button';
  floatingButton.innerHTML = `
    <div class="button-content">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>Legit Check</span>
      <div class="fact-check-spinner" style="display: none;">
        <div class="spinner-circle"></div>
      </div>
    </div>
  `;

  // Store reference to spinner
  spinner = floatingButton.querySelector('.fact-check-spinner');

  // Add click event
  floatingButton.addEventListener('click', async function () {
    if (isFactCheckInProgress) {
      return; // Prevent multiple simultaneous checks
    }

    // Get API key from storage
    chrome.storage.sync.get(['openaiApiKey'], async function (result) {
      if (!result.openaiApiKey) {
        alert('Please set your OpenAI API key in the extension popup first.');
        return;
      }

      await startFactCheck(result.openaiApiKey);
    });
  });

  // Add styles for the button
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .fact-check-floating-button {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background-color: #4285f4;
      color: white;
      border-radius: 50px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 13px;
    }
    
    .fact-check-floating-button:hover {
      background-color: #3367d6;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .button-content {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .fact-check-spinner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 4px;
    }
    
    .spinner-circle {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  document.head.appendChild(styleElement);
  document.body.appendChild(floatingButton);
  console.log('Floating button added to page');
}

// Function to extract article text
function extractArticleText() {
  console.log('Extracting article text...');

  // Get all paragraphs from the article
  const paragraphs = [];
  const paragraphElements = document.querySelectorAll('article p, .article p, .story p, .post p, .content p, main p');

  if (paragraphElements.length === 0) {
    // If no paragraphs found in standard article containers, try getting all paragraphs
    const allParagraphs = document.querySelectorAll('p');
    // Filter out paragraphs that are likely not part of the main content
    for (const p of allParagraphs) {
      // Skip very short paragraphs or those in footers, sidebars, etc.
      if (p.textContent.trim().length > 50 &&
        !p.closest('footer, aside, nav, .footer, .sidebar, .nav, .menu, .comments')) {
        paragraphs.push({
          element: p,
          text: p.textContent.trim()
        });
      }
    }
  } else {
    // Use the paragraphs from standard article containers
    for (const p of paragraphElements) {
      paragraphs.push({
        element: p,
        text: p.textContent.trim()
      });
    }
  }

  // Combine all paragraph texts
  const fullText = paragraphs.map(p => p.text).join('\n\n');
  console.log(`Extracted ${paragraphs.length} paragraphs, total length: ${fullText.length} characters`);

  if (fullText.length < 100) {
    console.warn('Very little text extracted, article extraction may have failed');
  }

  return {
    text: fullText,
    paragraphs: paragraphs
  };
}

// Function to start fact checking
async function startFactCheck(apiKey) {
  if (isFactCheckInProgress) {
    console.log('Fact check already in progress, ignoring request');
    return;
  }

  console.log('Starting fact check with API key length:', apiKey ? apiKey.length : 0);

  if (!apiKey) {
    console.error('No API key provided');
    alert('Please set your OpenAI API key in the extension popup first.');
    return;
  }

  try {
    // Show loading spinner
    isFactCheckInProgress = true;
    updateButtonState(true);

    // Extract article text
    console.log('Extracting article text...');
    const article = extractArticleText();

    if (!article || !article.text || article.text.trim().length < 100) {
      alert('Could not extract enough article text. Please make sure you are on a news article page.');
      isFactCheckInProgress = false;
      updateButtonState(false);
      return;
    }

    console.log('Article text extracted:', article.text.substring(0, 100) + '...');

    // Call OpenAI API
    console.log('Calling OpenAI API...');
    const factCheckResults = await callOpenAIAPI(apiKey, article.text);
    console.log('Received fact check results:', factCheckResults);

    // Process and highlight results
    if (factCheckResults.factCheckResults && factCheckResults.factCheckResults.length > 0) {
      processFactCheckResults(factCheckResults, article.paragraphs);
    } else {
      // No fact check issues found
      showNoCorrectionsOverlay(factCheckResults.politicalBias);
    }

    // Always show political bias meter
    if (factCheckResults.politicalBias) {
      showPoliticalBiasMeter(factCheckResults.politicalBias);
    }

    // Hide loading spinner
    isFactCheckInProgress = false;
    updateButtonState(false);
  } catch (error) {
    console.error('Error during fact check:', error);
    alert('Error during fact check: ' + error.message);
    isFactCheckInProgress = false;
    updateButtonState(false);
  }
}

// Function to call OpenAI API for fact-checking
async function callOpenAIAPI(apiKey, articleText) {
  console.log('Calling OpenAI API...');

  // Get current date
  const currentDate = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = currentDate.toLocaleDateString('en-US', options);

  // Construct the prompt for the API
  const prompt = `
  You are a fact-checking assistant that outputs formatted JSON data. The current date is ${formattedDate}. Please analyze the following article text for factual issues, statements that need clarification, and political bias. **It is crucial to use the most up-to-date information available through your search, especially for claims related to events or personnel changes since January 20, 2025.**

For each issue, please provide:
1. The exact claim text that contains the factual issue or needs clarification
2. An assessment of the accuracy: "completely_incorrect" (for demonstrably false claims based on the most current information), "partially_incorrect" (for misleading or incomplete claims), or "needs_clarification" (for claims that are not definitively incorrect but would benefit from additional context)
3. An explanation of why the claim is problematic or needs clarification. **When assessing accuracy, clearly state the "as of" date for the information you are using to make your determination. Be cautious before labeling a claim as "completely_incorrect," especially if it pertains to recent events or potential changes in roles. Double-check your sources for the very latest information.**
4. Reliable sources that support your assessment (URLs or names of reputable sources). **Prioritize sources with recent dates.**
5. The correct information or necessary clarification. Avoid repeating any details already mentioned in the explanation. Only include truly new or additional information here, and keep it concise.

Additionally, please assess the overall political bias of the article on a scale from -10 to +10 where:
- -10 represents extreme left/liberal bias
- 0 represents neutral/balanced reporting
- +10 represents extreme right/conservative bias

Please format your response as a JSON object with the following structure:
{
  "factCheckResults": [
    {
      "claimText": "The exact text of the claim",
      "accuracy": "completely_incorrect/partially_incorrect/needs_clarification",
      "explanation": "Why the claim is problematic or needs clarification" - use bullet points,
      "sources": ["source1", "source2"],
      "counterArguments": "The correct information or necessary clarification (without duplicating the explanation)" - use bullet points
    }
  ],
  "politicalBias": {
    "score": -5 to +5,
    "explanation": "Brief explanation of why you assigned this bias score" - use bullet points
  }
}

Article text: ${articleText}
  `;

  const requestData = {
    model: "gpt-4o-search-preview",
    web_search_options: {},
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  };

  try {
    console.log('Making API request with key:', apiKey.substring(0, 5) + '...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // Extract the content from the response
    const content = data.choices[0].message.content;

    // Parse the JSON response
    try {
      // Find JSON in the response (it might be surrounded by markdown or other text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        return JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON found in the response');
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error('Failed to parse API response');
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

// Function to process fact check results and highlight them on the page
function processFactCheckResults(results, paragraphs) {
  console.log('Processing fact check results:', results);

  if (!results.factCheckResults || results.factCheckResults.length === 0) {
    console.log('No fact check results to process');
    alert('No factual issues found in this article!');
    return;
  }

  // Clear any existing highlights first
  clearAllHighlights();

  // Process each result
  results.factCheckResults.forEach(result => {
    const claimText = result.claimText;
    const accuracy = result.accuracy;
    
    // Format explanation and counterArguments as HTML bullet points
    let explanation = result.explanation;
    if (explanation) {
      if (Array.isArray(explanation)) {
        // If it's an array, create bullet points directly from array items
        explanation = '<ul class="fact-points">' + 
          explanation.map(point => `<li>${point}</li>`).join('') + 
          '</ul>';
      } else if (typeof explanation === 'string') {
        // Check if it already has HTML formatting
        if (!explanation.includes('<ul>') && !explanation.includes('<li>')) {
          // Split by commas and create bullet points
          const points = explanation.split(',').map(point => point.trim()).filter(Boolean);
          explanation = '<ul class="fact-points">' + 
            points.map(point => `<li>${point}</li>`).join('') + 
            '</ul>';
        }
      } else {
        // If it's another type, convert to string
        explanation = '<ul class="fact-points"><li>' + JSON.stringify(explanation) + '</li></ul>';
      }
    }
    
    let counterArguments = result.counterArguments;
    if (counterArguments) {
      if (Array.isArray(counterArguments)) {
        // If it's an array, create bullet points directly from array items
        counterArguments = '<ul class="fact-points">' + 
          counterArguments.map(point => `<li>${point}</li>`).join('') + 
          '</ul>';
      } else if (typeof counterArguments === 'string') {
        // Check if it already has HTML formatting
        if (!counterArguments.includes('<ul>') && !counterArguments.includes('<li>')) {
          // Split by commas and create bullet points
          const points = counterArguments.split(',').map(point => point.trim()).filter(Boolean);
          counterArguments = '<ul class="fact-points">' + 
            points.map(point => `<li>${point}</li>`).join('') + 
            '</ul>';
        }
      } else {
        // If it's another type, convert to string
        counterArguments = '<ul class="fact-points"><li>' + JSON.stringify(counterArguments) + '</li></ul>';
      }
    }
    
    const sources = result.sources;

    console.log(`Processing claim: "${claimText.substring(0, 50)}..."`);

    // Determine highlight color based on accuracy
    const highlightClass = accuracy === 'completely_incorrect' ?
      'fact-check-highlight-red' : accuracy === 'partially_incorrect' ? 'fact-check-highlight-yellow' : 'fact-check-highlight-blue';

    // Find the claim text in paragraphs
    paragraphs.forEach(paragraph => {
      const paragraphText = paragraph.text;
      if (paragraphText.includes(claimText)) {
        console.log(`Found claim in paragraph: "${paragraphText.substring(0, 50)}..."`);

        // Create a wrapper for the paragraph to maintain layout
        const wrapper = document.createElement('span');

        // Replace the claim text with highlighted version
        wrapper.innerHTML = paragraphText.replace(
          new RegExp(escapeRegExp(claimText), 'g'),
          `<span class="fact-check-highlight ${highlightClass}" 
                data-explanation="${escapeHtml(explanation || '')}"
                data-sources="${escapeHtml(JSON.stringify(sources || []))}"
                data-counter="${escapeHtml(counterArguments || '')}"
                data-accuracy="${accuracy}">${claimText}</span>`
        );

        // Replace paragraph content with highlighted version
        paragraph.element.innerHTML = '';
        paragraph.element.appendChild(wrapper);

        // Add to our tracked elements
        const highlightedElement = paragraph.element.querySelector('.fact-check-highlight');
        if (highlightedElement) {
          highlightedElements.push(highlightedElement);

          // Add tooltip functionality
          highlightedElement.addEventListener('mouseenter', function (event) {
            showTooltip(event.target);
          });
        }
      }
    });
  });

  // Add styles for highlights and tooltips if not already added
  if (!document.getElementById('fact-check-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'fact-check-styles';
    styleElement.textContent = `
      .fact-check-highlight {
        padding: 2px 0;
        border-radius: 2px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .fact-check-highlight-yellow {
        background-color: rgba(255, 235, 59, 0.5);
        border-bottom: 2px solid #FFC107;
      }
      .fact-check-highlight-red {
        background-color: rgba(244, 67, 54, 0.3);
        border-bottom: 2px solid #F44336;
      }
      .fact-check-highlight-blue {
        background-color: rgba(66, 133, 244, 0.3);
        border-bottom: 2px solid #4285f4;
      }
      .fact-check-highlight:hover {
        filter: brightness(1.1);
      }
      .fact-check-tooltip {
        position: absolute;
        max-width: 400px;
        background-color: white;
        border: none;
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        overflow: hidden;
        animation: tooltip-fade-in 0.2s ease;
      }
      
      @keyframes tooltip-fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #f8f9fa;
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
      }
      
      .clarification-tooltip .tooltip-header {
        background-color: #E3F2FD;
      }
      
      .clarification-tooltip .tooltip-header h3 {
        color: #0277BD;
      }
      
      .tooltip-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }
      
      .close-button {
        background: none;
        border: none;
        font-size: 20px;
        color: #666;
        cursor: pointer;
        padding: 0;
        margin: 0;
        line-height: 1;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s ease;
      }
      
      .close-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }
      
      .tooltip-content {
        padding: 16px;
      }
      
      .tooltip-content p {
        margin: 0 0 16px 0;
        color: #333;
      }
      
      .sources-container {
        padding: 0 16px 16px 16px;
      }
      
      .sources-container h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: #555;
      }
      
      .source-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .source-button {
        display: flex;
        align-items: center;
        gap: 6px;
        background-color: #f0f2f5;
        border-radius: 6px;
        padding: 6px 10px;
        text-decoration: none;
        color: #333;
        font-size: 13px;
        transition: background-color 0.2s ease;
      }
      
      .source-button:hover {
        background-color: #e4e6eb;
      }
      
      .source-icon {
        width: 24px;
        height: 24px;
        background-color: #4285f4;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
      }
      
      .fact-points-container {
        padding: 16px;
      }
      
      .fact-section {
        margin-bottom: 16px;
      }
      
      .fact-section h4 {
        display: flex;
        align-items: center;
        font-size: 15px;
        margin: 0 0 8px 0;
        color: #333;
      }
      
      .fact-icon {
        width: 20px;
        height: 20px;
        margin-right: 8px;
        vertical-align: middle;
      }
      
      .fact-issue-icon {
        fill: #F44336;
      }
      
      .fact-correct-icon {
        fill: #4CAF50;
      }
      
      .fact-clarification-icon {
        fill: #FF9800;
      }
      
      .fact-additional-icon {
        fill: #03A9F4;
      }
      
      .clarification-tooltip .fact-section h4 {
        color: #0277BD;
      }
      
      .fact-points {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .fact-points li {
        position: relative;
        padding-left: 20px;
        margin-bottom: 8px;
        color: #333;
      }
      
      .fact-points li:before {
        content: "\\2022";
        position: absolute;
        left: 5px;
        color: #666;
      }
      
      .fact-points li:last-child {
        margin-bottom: 0;
      }
      
      /* Political Bias Meter Styles */
      .political-bias-meter {
        position: fixed;
        max-width: 350px;
        width: 320px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        overflow: hidden;
        animation: bias-fade-in 0.3s ease;
      }
      
      @keyframes bias-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .bias-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #f8f9fa;
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
      }
      
      .bias-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }
      
      .bias-close-button {
        background: none;
        border: none;
        font-size: 20px;
        color: #000;
        cursor: pointer;
        padding: 0;
        margin: 0;
        line-height: 1;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s ease;
      }
      
      .bias-close-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }
      
      .bias-content {
        padding: 16px;
      }
      
      .bias-scale {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .bias-label {
        font-size: 12px;
        font-weight: 600;
        width: 40px;
      }
      
      .bias-label.left {
        color: #2196F3;
        text-align: right;
        padding-right: 8px;
      }
      
      .bias-label.right {
        color: #F44336;
        text-align: left;
        padding-left: 8px;
      }
      
      .bias-bar {
        flex-grow: 1;
        height: 12px;
        background-color: #f0f2f5;
        border-radius: 6px;
        position: relative;
        overflow: hidden;
      }
      
      .bias-gradient {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to right, #2196F3, #E0E0E0, #F44336);
        border-radius: 6px;
      }
      
      .bias-indicator {
        position: absolute;
        width: 12px;
        height: 12px;
        background-color: #333;
        border-radius: 50%;
        top: 0;
        transform: translateX(-50%);
        z-index: 1;
      }
      
      .bias-score {
        text-align: center;
        font-weight: 600;
        margin-bottom: 12px;
      }
      
      .bias-explanation {
        color: #555;
        font-size: 13px;
      }
      
      /* No Corrections Overlay Styles */
      .no-corrections-overlay {
        position: fixed;
        max-width: 300px;
        width: 280px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        overflow: hidden;
        animation: overlay-fade-in 0.3s ease;
      }
      
      @keyframes overlay-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #E8F5E9;
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
      }
      
      .overlay-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #2E7D32;
      }
      
      .overlay-close-button {
        background: none;
        border: none;
        font-size: 20px;
        color: #666;
        cursor: pointer;
        padding: 0;
        margin: 0;
        line-height: 1;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s ease;
      }
      
      .overlay-close-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }
      
      .overlay-content {
        padding: 16px;
        text-align: center;
      }
      
      .overlay-icon {
        margin-bottom: 12px;
      }
      
      .overlay-icon svg {
        width: 48px;
        height: 48px;
        fill: #4CAF50;
      }
      
      .overlay-message {
        font-weight: 500;
        color: #333;
      }
    `;
    document.head.appendChild(styleElement);
  }

  console.log(`Highlighted ${highlightedElements.length} claims on the page`);

  // Jump to the first highlighted element
  if (highlightedElements.length > 0) {
    highlightedElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Function to show tooltip
function showTooltip(element) {
  // Remove any existing tooltips first
  hideTooltip();

  const tooltip = document.createElement('div');
  tooltip.className = 'fact-check-tooltip';
  tooltip.id = 'fact-check-active-tooltip';
  tooltip.setAttribute('data-source-element-id', element.id || `highlight-${Date.now()}`);

  // Ensure the source element has an ID for tracking
  if (!element.id) {
    element.id = `highlight-${Date.now()}`;
  }

  // Get data from the element
  const explanation = element.getAttribute('data-explanation');
  const sourcesJson = element.getAttribute('data-sources');
  const counter = element.getAttribute('data-counter');
  const accuracy = element.getAttribute('data-accuracy');

  // Determine if this is a clarification or fact check
  const isClarification = accuracy === 'needs_clarification';
  const tooltipTitle = isClarification ? 'Clarification' : 'Fact Check';

  // Add appropriate class for styling
  if (isClarification) {
    tooltip.classList.add('clarification-tooltip');
  }

  // Combine explanation and counter into one concise paragraph
  const combinedInfo = combineInformation(explanation, counter, accuracy);

  // Parse sources
  let sourcesHtml = '';
  let sources = [];
  try {
    sources = JSON.parse(sourcesJson);
    if (sources && sources.length > 0) {
      sources.forEach(source => {
        // Extract domain name for the source
        let domain = '';
        try {
          if (source.includes('http')) {
            const url = new URL(source);
            domain = url.hostname.replace('www.', '');
          } else {
            // Try to extract a domain-like name from the text
            const domainMatch = source.match(/([\w-]+\.[\w-]+)/);
            domain = domainMatch ? domainMatch[0] : source;
          }
        } catch (e) {
          domain = source;
        }

        // Create a button with the domain name
        sourcesHtml += `<a href="${source}" target="_blank" class="source-button">
          <div class="source-icon">${domain.charAt(0).toUpperCase()}</div>
          <span>${domain}</span>
        </a>`;
      });
    }
  } catch (e) {
    console.error('Error parsing sources:', e);
  }

  // Build tooltip content
  tooltip.innerHTML = `
    <div class="tooltip-header ${isClarification ? 'clarification-header' : ''}">
      <h3>${tooltipTitle}</h3>
      <button class="close-button">&times;</button>
    </div>
    ${combinedInfo}
    ${sources && sources.length > 0 ? `
    <div class="sources-container">
      <h4>Sources:</h4>
      <div class="source-buttons">
        ${sourcesHtml}
      </div>
    </div>
    ` : ''}
  `;

  // Position the tooltip
  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${Math.max(0, rect.left + window.scrollX)}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;

  // Add tooltip to body
  document.body.appendChild(tooltip);

  // Store reference to the active tooltip and highlighted element
  window.activeTooltipData = {
    tooltip: tooltip,
    highlightElement: element
  };

  // Add event listener to close button
  const closeButton = tooltip.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', function () {
      hideTooltip();
    });
  }

  // Add document click handler to close tooltip when clicking outside
  setTimeout(() => {
    document.addEventListener('click', handleDocumentClick);
  }, 100);
}

// Function to hide tooltip
function hideTooltip() {
  // Remove document click handler
  document.removeEventListener('click', handleDocumentClick);

  // Remove the tooltip
  const tooltips = document.querySelectorAll('.fact-check-tooltip');
  tooltips.forEach(tooltip => tooltip.remove());

  // Clear active tooltip data
  window.activeTooltipData = null;
}

// Handle clicks on the document to close tooltip when clicking outside
function handleDocumentClick(event) {
  // If we don't have active tooltip data, do nothing
  if (!window.activeTooltipData) return;

  const { tooltip, highlightElement } = window.activeTooltipData;

  // Check if the click was inside the tooltip or the highlighted element
  if (tooltip.contains(event.target) || highlightElement.contains(event.target)) {
    // Click was inside tooltip or highlight, do nothing
    return;
  }

  // Click was outside, close the tooltip
  hideTooltip();
}

// Helper function to combine explanation and counter information
function combineInformation(explanation, counter, accuracy) {
  const points = [];
  const correctPoints = [];

  // No longer splitting by sentences - using the entire text as provided
  if (explanation && explanation.trim()) {
    points.push(explanation.trim());
  }

  if (counter && counter.trim()) {
    correctPoints.push(counter.trim());
  }

  if (points.length === 0 && correctPoints.length === 0) {
    return explanation || counter || 'No additional information available.';
  }

  // Build the bullet-point HTML
  let html = '<div class="fact-points-container">';
  const isClarification = accuracy === 'needs_clarification';

  // Explanation/Issue section
  if (points.length > 0) {
    html += '<div class="fact-section">';
    if (isClarification) {
      html += `
        <h4>
          <svg class="fact-icon fact-clarification-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          Clarification
        </h4>`;
    } else {
      html += `
        <h4>
          <svg class="fact-icon fact-issue-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Issue
        </h4>`;
    }
    // Directly insert the explanation text which should already contain bullet points from the API response
    html += points[0];
    html += '</div>';
  }

  // Correct info / Additional Context section
  if (correctPoints.length > 0) {
    html += '<div class="fact-section">';
    if (isClarification) {
      html += `
        <h4>
          <svg class="fact-icon fact-additional-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Additional Context
        </h4>`;
    } else {
      html += `
        <h4>
          <svg class="fact-icon fact-correct-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          Correct Information
        </h4>`;
    }
    // Directly insert the counter text which should already contain bullet points from the API response
    html += correctPoints[0];
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// Function to add highlight styles
function addHighlightStyles() {
  // Don't add styles if they already exist
  if (document.getElementById('fact-check-styles')) {
    return;
  }

  // Add CSS styles for highlights and tooltips
  const styleElement = document.createElement('style');
  styleElement.id = 'fact-check-styles';
  styleElement.textContent = `
    /* Styles are now added in the processFactCheckResults function */
  `;

  document.head.appendChild(styleElement);
}

// Function to clear all highlights
function clearAllHighlights() {
  // Remove all tooltips
  const tooltips = document.querySelectorAll('.fact-check-tooltip');
  tooltips.forEach(tooltip => tooltip.remove());

  // Remove highlights by replacing with original text
  highlightedElements.forEach(element => {
    const parent = element.parentNode;
    const grandparent = parent.parentNode;
    if (parent && grandparent) {
      const textNode = document.createTextNode(element.textContent);
      grandparent.replaceChild(textNode, parent);
    }
  });

  // Reset the array
  highlightedElements = [];
}

// Function to update the button state (show/hide spinner)
function updateButtonState(isLoading) {
  if (!spinner) return;

  if (isLoading) {
    console.log('Showing loading spinner');
    spinner.style.display = 'inline-flex';
  } else {
    console.log('Hiding loading spinner');
    spinner.style.display = 'none';
  }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper function to escape RegExp
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Function to show political bias meter
function showPoliticalBiasMeter(biasData) {
  // Remove any existing bias meter
  const existingMeter = document.getElementById('political-bias-meter');
  if (existingMeter) {
    existingMeter.remove();
  }

  // Create the bias meter container
  const biasMeter = document.createElement('div');
  biasMeter.id = 'political-bias-meter';
  biasMeter.className = 'political-bias-meter';

  // Calculate position on the scale (-10 to +10)
  const score = Math.max(-10, Math.min(10, biasData.score)); // Ensure score is between -10 and +10
  const percentage = ((score + 10) / 20) * 100; // Convert to percentage (0-100%)

  // Convert the score into a more neutral display
  const absoluteScore = Math.abs(score);
  let biasDirection = '';
  if (score < 0) {
    biasDirection = 'Left';
  } else if (score > 0) {
    biasDirection = 'Right';
  } else {
    biasDirection = 'Neutral';
  }

  // Create the meter content with the revised bias text
  biasMeter.innerHTML = `
    <div class="bias-header">
      <h3>Political Bias Assessment</h3>
      <button class="bias-close-button">&times;</button>
    </div>
    <div class="bias-content">
      <div class="bias-scale">
        <div class="bias-label left">Left</div>
        <div class="bias-bar">
          <div class="bias-gradient"></div>
          <div class="bias-indicator" style="left: ${percentage}%;"></div>
        </div>
        <div class="bias-label right">Right</div>
      </div>
      <div class="bias-score">Bias: ${absoluteScore} ${biasDirection}</div>
      <div class="bias-explanation">${biasData.explanation}</div>
    </div>
  `;

  // Add event listener to close button
  biasMeter.querySelector('.bias-close-button').addEventListener('click', () => {
    biasMeter.remove();
  });

  // Add the bias meter to the page
  document.body.appendChild(biasMeter);

  // Position the bias meter at the bottom right corner of the screen
  biasMeter.style.bottom = '20px';
  biasMeter.style.right = '20px';
}

// Function to show no corrections overlay
function showNoCorrectionsOverlay(biasData) {
  // Remove any existing overlay
  const existingOverlay = document.getElementById('no-corrections-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create the overlay container
  const overlay = document.createElement('div');
  overlay.id = 'no-corrections-overlay';
  overlay.className = 'no-corrections-overlay';

  // Create the overlay content
  overlay.innerHTML = `
    <div class="overlay-header">
      <h3>Fact Check Complete</h3>
      <button class="overlay-close-button">&times;</button>
    </div>
    <div class="overlay-content">
      <div class="overlay-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
      </div>
      <div class="overlay-message">No factual issues found in this article.</div>
    </div>
  `;

  // Add event listener to close button
  overlay.querySelector('.overlay-close-button').addEventListener('click', () => {
    overlay.remove();
  });

  // Add the overlay to the page
  document.body.appendChild(overlay);

  // Position the overlay above the floating button
  const floatingButton = document.getElementById('fact-check-button');
  if (floatingButton) {
    const buttonRect = floatingButton.getBoundingClientRect();

    // Calculate position (80px above the button to appear above the bias meter)
    const bottomPosition = window.innerHeight - buttonRect.top + 80;

    // Position the overlay
    overlay.style.bottom = `${bottomPosition}px`;
    overlay.style.right = '20px';

    console.log('Positioning no corrections overlay:', {
      bottom: bottomPosition,
      buttonRect,
      windowInnerHeight: window.innerHeight
    });
  } else {
    // Fallback position if button not found
    overlay.style.bottom = '180px';
    overlay.style.right = '20px';
  }
}

// Run the initialization when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
