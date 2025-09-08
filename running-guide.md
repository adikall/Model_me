# Model Me Chrome Extension - Running Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Design Decisions](#architecture--design-decisions)
3. [Project Structure](#project-structure)
4. [Key Components Deep Dive](#key-components-deep-dive)
5. [Development Workflow](#development-workflow)
6. [Security Considerations](#security-considerations)
7. [Areas for Improvement](#areas-for-improvement)
8. [Getting Started](#getting-started)
9. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Model Me** is a Chrome extension that leverages Google's Gemini AI to transform style and fashion. Users can upload clothing images and their own photos to generate realistic model lookalikes wearing their outfits, all within Chrome's side panel.

### Core Functionality
- **AI-Powered Style Generation**: Uses Gemini 2.5 Flash Image Preview model for multimodal processing
- **Side Panel Interface**: Modern Chrome extension UI that opens in a dedicated side panel
- **Image Processing**: Supports multiple image uploads with base64 encoding
- **Real-time AI Interaction**: Direct integration with Google's Generative AI API

---

## Architecture & Design Decisions

### 1. Chrome Extension Manifest V3
```json
// manifest.json
{
  "manifest_version": 3,
  "permissions": ["sidePanel"],
  "host_permissions": ["https://generativelanguage.googleapis.com/*"]
}
```

**Why Manifest V3?**
- **Future-proof**: Google's latest extension standard
- **Enhanced Security**: Service workers instead of background pages
- **Better Performance**: Improved resource management

**Design Decision**: Side Panel over Popup
- **Reasoning**: Side panels provide more space for image uploads and AI responses
- **User Experience**: Persistent interface that doesn't close when clicking outside
- **Workflow Integration**: Better for iterative AI interactions

### 2. Build System: Rollup
```javascript
// rollup.config.js
export default {
  input: 'sidepanel/index.js',
  output: {
    file: 'dist/sidepanel.bundle.js',
    format: 'iife',
    name: 'ModelMe'
  },
  plugins: [nodeResolve({ browser: true }), commonjs(), json()]
};
```

**Why Rollup over Webpack?**
- **Smaller Bundle Size**: Tree-shaking eliminates unused code
- **Chrome Extension Compatibility**: IIFE format works well with extension security model
- **Simpler Configuration**: Less complex than Webpack for this use case

### 3. Google GenAI SDK Integration
```javascript
// sidepanel/index.js
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';

const MODEL_ID = 'gemini-2.5-flash-image-preview';
```

**Model Choice Reasoning**:
- **Gemini 2.5 Flash Image Preview**: Optimized for multimodal tasks (text + images)
- **Speed**: Flash variant provides faster responses for interactive use
- **Preview Access**: Early access to cutting-edge image generation capabilities

---

## Project Structure

```
model_me/
├── manifest.json           # Extension configuration
├── background.js          # Service worker (minimal)
├── package.json           # Node dependencies
├── rollup.config.js       # Build configuration
├── sidepanel/             # Main application code
│   ├── index.html         # UI structure
│   ├── index.js           # Core logic & AI integration
│   └── index.css          # Styling
├── images/                # Extension icons
├── dist/                  # Built artifacts (gitignored)
└── node_modules/          # Dependencies
```

### File Responsibilities

#### `manifest.json` - Extension Configuration
```json
{
  "side_panel": { "default_path": "sidepanel/index.html" },
  "permissions": ["sidePanel"],
  "host_permissions": ["https://generativelanguage.googleapis.com/*"]
}
```
- Defines extension metadata and permissions
- Configures side panel as the primary interface
- Grants access to Google's AI API endpoints

#### `background.js` - Service Worker
```javascript
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
```
- Minimal service worker that enables side panel opening on icon click
- **Design Decision**: Keep background script minimal for better performance

#### `sidepanel/index.html` - User Interface
Key UI elements:
```html
<textarea id="input-prompt" placeholder='Type something, e.g. "Write a haiku about Chrome Extensions"'></textarea>
<input type="range" id="temperature" min="0" max="2" step="0.01" value="1" />
<input type="file" id="image-input" accept="image/*" multiple />
<button id="button-prompt" class="primary" disabled>Run</button>
```

**UI Design Decisions**:
- **Temperature Slider**: Allows users to control AI creativity (0 = deterministic, 2 = very creative)
- **Multiple Image Upload**: Supports batch processing for style combinations
- **Disabled State Management**: Button only enables when prompt or images are provided

---

## Key Components Deep Dive

### 1. AI Client Initialization
```javascript
let ai = null;
function initClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: 'AIzaSyA2YtcJzjG7DBihByPTJyuIaLMI4TCmy4g' });
  }
  return ai;
}
```

**Singleton Pattern**: Ensures single AI client instance to avoid unnecessary API calls and memory usage.

### 2. Image Processing Pipeline
```javascript
async function fileToInlineData(file) {
  const base64Data = await readFileAsBase64(file);
  return {
    mimeType: file.type || 'application/octet-stream',
    data: base64Data
  };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
```

**Design Decisions**:
- **Base64 Encoding**: Required by Gemini API for image data
- **MIME Type Preservation**: Maintains image format information
- **Promise-based**: Async file reading for non-blocking UI

### 3. AI Request Construction
```javascript
async function runPrompt(prompt, temperature, imageFiles) {
  const parts = [];
  if (prompt && prompt.trim()) {
    parts.push({ text: prompt.trim() });
  }
  if (imageFiles && imageFiles.length) {
    for (let i = 0; i < imageFiles.length; i++) {
      const inlineData = await fileToInlineData(imageFiles[i]);
      parts.push({ inlineData });
    }
  }

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: parts,
    config: {
      temperature: Number(temperature) || 1,
      safetySettings,
    }
  });
}
```

**Multimodal Request Structure**:
- **Parts Array**: Combines text and image data in single request
- **Sequential Processing**: Images processed one by one to avoid memory issues
- **Safety Settings**: Configured to allow creative content generation

### 4. Response Handling & Rendering
```javascript
function extractTextFromResponse(modelResponse) {
  const candidates = Array.isArray(modelResponse.candidates) ? modelResponse.candidates : [];
  const pieces = [];
  for (let i = 0; i < candidates.length; i++) {
    const parts = candidates[i].content.parts;
    for (let j = 0; j < parts.length; j++) {
      if (parts[j].text) {
        pieces.push(parts[j].text);
      }
    }
  }
  return { text: pieces.join('\n') };
}
```

**Custom Response Parsing**: Avoids SDK warnings by manually extracting text from response structure instead of using deprecated `response.text`.

---

## Development Workflow

### 1. Setup & Installation
```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome (development)
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the project directory
```

### 2. Development Cycle
1. **Code Changes**: Edit files in `sidepanel/`
2. **Build**: Run `npm run build` to generate `dist/sidepanel.bundle.js`
3. **Reload Extension**: Click reload button in chrome://extensions/
4. **Test**: Open side panel and test functionality

### 3. Build Process Details
```javascript
// The build process:
// sidepanel/index.js → [Rollup] → dist/sidepanel.bundle.js
// 
// Rollup handles:
// - ES6 module bundling
// - Node.js module resolution for browser
// - CommonJS compatibility
// - JSON imports
```

---

## Security Considerations

### 1. API Key Exposure ⚠️
```javascript
// CURRENT CODE (INSECURE):
ai = new GoogleGenAI({ apiKey: 'AIzaSyA2YtcJzjG7DBihByPTJyuIaLMI4TCmy4g' });
```

**Critical Security Issue**: API key is hardcoded and exposed in client-side code.

### 2. Host Permissions
```json
"host_permissions": ["https://generativelanguage.googleapis.com/*"]
```
**Appropriate Scope**: Only grants access to Google's AI API, following principle of least privilege.

### 3. Content Security Policy
**Current State**: Relies on Chrome's default CSP for extensions
**Consideration**: Manifest V3 provides good default security

---

## Areas for Improvement

### 1. 🚨 Critical: API Key Security
**Current Issue**: Hardcoded API key in client code
```javascript
// BAD: Exposed API key
ai = new GoogleGenAI({ apiKey: 'AIzaSyA2YtcJzjG7DBihByPTJyuIaLMI4TCmy4g' });
```

**Solutions**:
```javascript
// Option 1: User-provided key
const apiKey = await chrome.storage.sync.get(['geminiApiKey']);

// Option 2: Backend proxy
const response = await fetch('https://your-backend.com/api/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt, images })
});
```

### 2. Error Handling & User Experience
**Current Limitations**:
- Generic error messages
- No retry mechanism
- No offline handling

**Improvements**:
```javascript
// Better error handling
try {
  const response = await runPrompt(prompt, temperature, imageFiles);
  showResponse(response);
} catch (error) {
  if (error.status === 429) {
    showError('Rate limit reached. Please try again in a few minutes.');
  } else if (error.status === 401) {
    showError('Invalid API key. Please check your configuration.');
  } else {
    showError(`Request failed: ${error.message}`);
  }
}
```

### 3. Performance Optimizations
**Image Processing**:
```javascript
// Current: Sequential processing
for (let i = 0; i < imageFiles.length; i++) {
  const inlineData = await fileToInlineData(imageFiles[i]);
  parts.push({ inlineData });
}

// Better: Parallel processing + compression
const imagePromises = imageFiles.map(async (file) => {
  const compressed = await compressImage(file);
  return fileToInlineData(compressed);
});
const inlineDataArray = await Promise.all(imagePromises);
```

### 4. State Management
**Current Issue**: Global variables and direct DOM manipulation
```javascript
// Current approach
const selectedImageFiles = [];
let ai = null;
```

**Improvement**: Implement proper state management
```javascript
class ModelMeApp {
  constructor() {
    this.state = {
      selectedImages: [],
      isLoading: false,
      lastResponse: null
    };
  }
  
  updateState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }
}
```

### 5. Configuration Management
**Add Settings Panel**:
```javascript
// Settings management
const defaultSettings = {
  temperature: 1.0,
  maxImages: 5,
  imageQuality: 0.8,
  model: 'gemini-2.5-flash-image-preview'
};

async function loadSettings() {
  const settings = await chrome.storage.sync.get(defaultSettings);
  return settings;
}
```

### 6. Accessibility Improvements
**Current Issues**:
- No ARIA labels
- Poor keyboard navigation
- No screen reader support

**Solutions**:
```html
<button id="button-prompt" 
        class="primary" 
        aria-label="Generate AI response"
        aria-describedby="prompt-help">
  Run
</button>
<div id="prompt-help" class="sr-only">
  Click to send your prompt and images to the AI model
</div>
```

### 7. Testing Infrastructure
**Currently Missing**:
- Unit tests
- Integration tests
- E2E testing

**Recommended Setup**:
```javascript
// Jest configuration for Chrome extension testing
// package.json
{
  "scripts": {
    "test": "jest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

### 8. Development Experience
**Add Development Tools**:
```javascript
// Hot reload for development
// package.json
{
  "scripts": {
    "dev": "rollup -c -w",
    "build": "rollup -c",
    "lint": "eslint sidepanel/",
    "format": "prettier --write sidepanel/"
  }
}
```

---

## Getting Started

### Prerequisites
- Node.js 16+
- Chrome browser
- Google AI API key (for production use)

### Development Setup
1. **Clone and Install**:
   ```bash
   cd /path/to/model_me
   npm install
   ```

2. **Build the Extension**:
   ```bash
   npm run build
   ```

3. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `model_me` directory

4. **Test the Extension**:
   - Click the extension icon in Chrome toolbar
   - Side panel should open
   - Try entering a prompt or uploading images

### Production Deployment
1. **Secure API Key**: Implement proper API key management
2. **Build for Production**: `npm run build`
3. **Package Extension**: Zip the entire directory (excluding node_modules)
4. **Chrome Web Store**: Submit for review

---

## Troubleshooting

### Common Issues

#### 1. Extension Won't Load
**Symptoms**: Error when loading unpacked extension
**Solutions**:
- Check `manifest.json` syntax
- Ensure all referenced files exist
- Run `npm run build` to generate bundle

#### 2. Side Panel Won't Open
**Symptoms**: Clicking extension icon does nothing
**Solutions**:
```javascript
// Check background.js is working
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Side panel error:', error));
```

#### 3. AI Requests Failing
**Symptoms**: Error messages in response
**Common Causes**:
- Invalid API key
- Rate limiting
- Network connectivity
- Image size too large

**Debug Steps**:
```javascript
// Enable debug logging
const DEBUG = true;
function logDebug(...args) {
  if (DEBUG) console.log('[ModelMe Debug]', ...args);
}
```

#### 4. Build Failures
**Symptoms**: `npm run build` fails
**Solutions**:
- Check Node.js version compatibility
- Clear `node_modules` and reinstall
- Verify Rollup configuration

### Debug Console Access
- **Extension Console**: Right-click extension icon → "Inspect popup" → Console
- **Side Panel Console**: Open side panel → F12 → Console
- **Background Script**: chrome://extensions → Extension details → "Inspect views: background page"

---

## Next Steps for New Developer

1. **Immediate Tasks**:
   - Fix API key security issue
   - Add proper error handling
   - Implement user settings storage

2. **Short-term Goals**:
   - Add image compression
   - Improve UI/UX
   - Add loading states

3. **Long-term Vision**:
   - Add more AI models
   - Implement style templates
   - Add sharing functionality
   - Build user authentication

4. **Learning Resources**:
   - [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
   - [Google GenAI SDK](https://googleapis.github.io/js-genai/)
   - [Rollup.js Guide](https://rollupjs.org/guide/)

---

**Remember**: This extension has great potential but needs security hardening and UX improvements before production use. Focus on the API key security issue first, then work on user experience enhancements.
