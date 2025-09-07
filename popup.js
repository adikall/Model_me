// Initialize variables
let apiKey = '';
let uploadedImages = { image1: null, image2: null };

// DOM elements
const elements = {
  apiKeyInput: null,
  saveApiKey: null,
  chatMessages: null,
  textPrompt: null,
  sendButton: null,
  image1: null,
  image2: null,
  preview1: null,
  preview2: null,
  remove1: null,
  remove2: null
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  elements.apiKeyInput = document.getElementById('apiKeyInput');
  elements.saveApiKey = document.getElementById('saveApiKey');
  elements.chatMessages = document.getElementById('chatMessages');
  elements.textPrompt = document.getElementById('textPrompt');
  elements.sendButton = document.getElementById('sendButton');
  elements.image1 = document.getElementById('image1');
  elements.image2 = document.getElementById('image2');
  elements.preview1 = document.getElementById('preview1');
  elements.preview2 = document.getElementById('preview2');
  elements.remove1 = document.getElementById('remove1');
  elements.remove2 = document.getElementById('remove2');

  // Load saved API key (non-blocking)
  try {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        // Surface storage error but do not block UI
        showError('Storage error: ' + chrome.runtime.lastError.message);
        return;
      }
      if (result && result.geminiApiKey) {
        apiKey = result.geminiApiKey;
        if (elements.apiKeyInput) {
          elements.apiKeyInput.value = apiKey;
        }
      }
    });
  } catch (e) {
    // In some environments, storage may throw; fail gracefully
    // No-op
  }

  // Event listeners
  elements.saveApiKey.addEventListener('click', saveApiKey);
  elements.sendButton.addEventListener('click', sendMessage);
  elements.textPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Image upload handlers
  elements.image1.addEventListener('change', (e) => handleImageUpload(e, 1));
  elements.image2.addEventListener('change', (e) => handleImageUpload(e, 2));
  elements.remove1.addEventListener('click', () => removeImage(1));
  elements.remove2.addEventListener('click', () => removeImage(2));
});

// Save API key to storage
async function saveApiKey() {
  const saveButton = elements.saveApiKey;
  const originalText = saveButton.textContent;
  
  apiKey = elements.apiKeyInput.value.trim();
  if (apiKey) {
    // Update button to show saving state
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    saveButton.style.background = 'rgba(255, 255, 255, 0.2)';
    
    await chrome.storage.local.set({ geminiApiKey: apiKey });
    
    // Show success state
    saveButton.textContent = '✓ Saved';
    saveButton.style.background = 'rgba(76, 175, 80, 0.3)';
    
    // Also show notification in chat
    showNotification('API key saved successfully!');
    
    // Reset button after 2 seconds
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      saveButton.style.background = 'rgba(255, 255, 255, 0.3)';
    }, 2000);
  } else {
    // Show error state on button
    saveButton.textContent = '✗ Error';
    saveButton.style.background = 'rgba(244, 67, 54, 0.3)';
    
    showError('Please enter a valid API key');
    
    // Reset button after 2 seconds
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.style.background = 'rgba(255, 255, 255, 0.3)';
    }, 2000);
  }
}

// Handle image upload
function handleImageUpload(event, imageNumber) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showError('Please upload an image file');
    event.target.value = ''; // Clear the input
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64String = e.target.result.split(',')[1];
    uploadedImages[`image${imageNumber}`] = {
      data: base64String,
      mimeType: file.type,
      name: file.name
    };

    // Show preview - fixed to ensure proper display
    const preview = elements[`preview${imageNumber}`];
    const label = document.querySelector(`label[for="image${imageNumber}"]`);
    const removeBtn = elements[`remove${imageNumber}`];
    const imageSlot = document.getElementById(`imageSlot${imageNumber}`);

    // Set the preview image source
    preview.src = e.target.result;
    preview.style.display = 'block';
    preview.style.position = 'absolute';
    preview.style.top = '0';
    preview.style.left = '0';
    preview.style.width = '100%';
    preview.style.height = '100%';
    preview.style.objectFit = 'cover';
    
    // Hide the upload label
    label.style.display = 'none';
    
    // Show the remove button
    removeBtn.style.display = 'flex';
    
    // Add visual feedback
    imageSlot.style.borderColor = '#667eea';
    imageSlot.style.borderStyle = 'solid';
  };

  reader.onerror = function() {
    showError('Failed to read the image file');
    event.target.value = ''; // Clear the input
  };

  reader.readAsDataURL(file);
}

// Remove uploaded image
function removeImage(imageNumber) {
  uploadedImages[`image${imageNumber}`] = null;
  
  const input = elements[`image${imageNumber}`];
  const preview = elements[`preview${imageNumber}`];
  const label = document.querySelector(`label[for="image${imageNumber}"]`);
  const removeBtn = elements[`remove${imageNumber}`];
  const imageSlot = document.getElementById(`imageSlot${imageNumber}`);

  input.value = '';
  preview.src = '';
  preview.style.display = 'none';
  label.style.display = 'flex';
  removeBtn.style.display = 'none';
  
  // Reset border style
  imageSlot.style.borderColor = '#ddd';
  imageSlot.style.borderStyle = 'dashed';
}

// Send message to Gemini API
async function sendMessage() {
  const prompt = elements.textPrompt.value.trim();
  
  if (!prompt && !uploadedImages.image1 && !uploadedImages.image2) {
    showError('Please enter a message or upload at least one image');
    return;
  }

  if (!apiKey) {
    showError('Please enter your API key first');
    return;
  }

  // Clear input
  elements.textPrompt.value = '';

  // Add user message to chat
  addUserMessage(prompt, uploadedImages);

  // Show loading indicator
  showLoading();

  try {
    // Prepare the request body
    const parts = [];
    
    // Add images if uploaded
    if (uploadedImages.image1) {
      parts.push({
        inline_data: {
          mime_type: uploadedImages.image1.mimeType,
          data: uploadedImages.image1.data
        }
      });
    }
    
    if (uploadedImages.image2) {
      parts.push({
        inline_data: {
          mime_type: uploadedImages.image2.mimeType,
          data: uploadedImages.image2.data
        }
      });
    }

    // Add text prompt
    if (prompt) {
      parts.push({ text: prompt });
    }

    // Make API request to Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }]
        })
      }
    );

    hideLoading();

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    
    // Extract response text
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received';
    
    // Add AI response to chat
    addAIMessage(responseText);

    // Clear uploaded images after sending
    removeImage(1);
    removeImage(2);

  } catch (error) {
    hideLoading();
    showError(`Error: ${error.message}`);
  }
}

// Add user message to chat
function addUserMessage(text, images) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  
  let messageHTML = '';
  
  // Add images if present
  if (images.image1 || images.image2) {
    messageHTML += '<div class="message-images">';
    if (images.image1) {
      const preview1 = document.getElementById('preview1');
      messageHTML += `<img src="${preview1.src}" class="message-image">`;
    }
    if (images.image2) {
      const preview2 = document.getElementById('preview2');
      messageHTML += `<img src="${preview2.src}" class="message-image">`;
    }
    messageHTML += '</div>';
  }
  
  // Add text if present
  if (text) {
    messageHTML += `<div class="message-content">${escapeHtml(text)}</div>`;
  }
  
  messageDiv.innerHTML = messageHTML;
  
  // Remove welcome message if it exists
  const welcomeMessage = document.querySelector('.welcome-message');
  if (welcomeMessage) {
    welcomeMessage.remove();
  }
  
  elements.chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// Add AI message to chat
function addAIMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';
  
  // Process the text for better formatting
  const formattedText = formatAIResponse(text);
  
  messageDiv.innerHTML = `<div class="message-content">${formattedText}</div>`;
  elements.chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// Format AI response with basic markdown support
function formatAIResponse(text) {
  // Escape HTML first
  let formatted = escapeHtml(text);
  
  // Convert markdown-like formatting
  // Bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  // Code blocks
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
  
  return formatted;
}

// Show loading indicator
function showLoading() {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message ai-message';
  loadingDiv.id = 'loading-indicator';
  loadingDiv.innerHTML = `
    <div class="loading">
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
    </div>
  `;
  elements.chatMessages.appendChild(loadingDiv);
  scrollToBottom();
}

// Hide loading indicator
function hideLoading() {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  elements.chatMessages.appendChild(errorDiv);
  scrollToBottom();
  
  // Remove error after 5 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Show notification
function showNotification(message) {
  const notificationDiv = document.createElement('div');
  notificationDiv.className = 'message ai-message';
  notificationDiv.innerHTML = `<div class="message-content" style="background: #e8f5e9; color: #2e7d32;">${message}</div>`;
  elements.chatMessages.appendChild(notificationDiv);
  scrollToBottom();
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notificationDiv.remove();
  }, 3000);
}

// Scroll chat to bottom
function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}