# Gemini Chat Chrome Extension

A Chrome extension that allows you to chat with Google's Gemini 1.5 Flash model using images and text.

## Features

- **Dual Image Upload**: Upload up to 2 images to analyze with Gemini
- **Text Prompts**: Combine images with text prompts for detailed analysis
- **Beautiful Chat Interface**: Modern, gradient-styled chat UI
- **Secure API Key Storage**: Your API key is stored locally and securely

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this extension directory
4. The extension will appear in your Chrome toolbar

## Setup

1. Click on the extension icon in your Chrome toolbar
2. Enter your Gemini API key in the input field at the top
3. Click "Save" to store the API key

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

## Usage

1. **Upload Images** (Optional):
   - Click on the image slots to upload up to 2 images
   - Supported formats: JPG, PNG, GIF, WebP
   - Click the × button to remove an uploaded image

2. **Enter Your Prompt**:
   - Type your message in the text area
   - You can send text alone or combine it with images

3. **Send Message**:
   - Click the send button (➤) or press Enter to send
   - The response from Gemini will appear in the chat

## Features in Detail

- **Image Analysis**: Upload images for Gemini to analyze, compare, or describe
- **Text + Image Combinations**: Ask questions about uploaded images
- **Formatted Responses**: AI responses support basic markdown formatting
- **Persistent API Key**: Your API key is saved locally for convenience
- **Clean Chat Interface**: Messages are displayed in a scrollable chat format

## Privacy

- Your API key is stored locally in Chrome's storage
- Images are sent directly to Google's API
- No data is stored on external servers

## Troubleshooting

- **"Please enter your API key first"**: Make sure you've entered and saved a valid API key
- **API Errors**: Check that your API key is valid and has the necessary permissions
- **Image Upload Issues**: Ensure images are in supported formats and not too large

## Development

The extension consists of:
- `manifest.json`: Chrome extension configuration
- `popup.html`: The extension's UI structure
- `popup.css`: Styling for the modern chat interface
- `popup.js`: Core functionality and Gemini API integration