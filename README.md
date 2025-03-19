# FactCheck Assistant Chrome Extension

A Chrome extension that acts as "Grammarly for fact checking." It analyzes articles, identifies potentially incorrect claims, and provides sources and counter-arguments.

## Features

- Extracts text from articles you're reading
- Uses OpenAI's GPT-4o with search capability to fact-check claims
- Highlights partially incorrect claims in yellow and completely incorrect claims in red
- Shows detailed explanations, sources, and counter-arguments on hover
- Provides a convenient floating button on news articles for one-click fact checking

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the directory containing this extension
5. The extension should now appear in your Chrome toolbar

## Usage

### Method 1: Using the Floating Button (Recommended)
1. Navigate to a news article you want to fact-check
2. A blue "Fact Check" button will appear in the bottom-right corner of the page
3. Click the button to start fact-checking
4. If this is your first time, you'll be prompted to enter your OpenAI API key in the extension popup
5. The button will show a loading spinner while the fact-check is in progress
6. Highlighted text will appear on the page:
   - Yellow: Partially incorrect claims
   - Red: Completely incorrect claims
7. Hover over highlighted text to see explanations, sources, and counter-arguments

### Method 2: Using the Extension Popup
1. Navigate to an article you want to fact-check
2. Click on the FactCheck Assistant icon in your Chrome toolbar
3. Enter your OpenAI API key (you only need to do this once)
4. Click "Check Facts on This Page"
5. Wait for the analysis to complete
6. Highlighted text will appear on the page
7. Click "Clear Highlights" to remove all highlights from the page

## Getting an OpenAI API Key

1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Sign in with your OpenAI account or create a new one
3. Create a new API key
4. Copy the API key and paste it into the extension

## Technical Details

This extension uses:
- Chrome Extension Manifest V3
- OpenAI's GPT-4o-search-preview model with web search capability for up-to-date fact checking
- JSON structured data for accurate parsing of fact-check results
- Automatic detection of news articles for the floating button feature

## Privacy

Your OpenAI API key is stored locally in your browser's storage and is never sent to any server other than OpenAI's API. The extension only processes the content of the current page when you explicitly click the "Check Facts" button or the floating button.

## Limitations

- The extension works best on standard news article formats
- Fact checking depends on the quality and availability of information through OpenAI's search capability
- Some complex or nuanced claims may not be properly identified
- API usage will count toward your OpenAI API quota and may incur charges
- Search capabilities are quite expensive compared to regular GPT prompts
