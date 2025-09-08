// Migrated for @google/genai v1.17.0
// Docs: https://googleapis.github.io/js-genai/ (Models.generateContent, GenerateContentConfig)

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory
} from '@google/genai';

// Important! Do not expose your API in client code for production.
// Prefer letting users supply a key, or proxy via your backend. (See SDK readme.)

// --- Client init (create once) ---
let ai = null;
function initClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: 'API_KEY' }); // Replace safely (server-side for prod).
  }
  return ai;
}

// Default model (swap as needed)
// Using Gemini 2.5 Flash Image Preview for multimodal support
const MODEL_ID = 'gemini-2.5-flash-image-preview';

// Baseline safety (example mirrors your previous "block none" for dangerous content)
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE
  }
];

// UI elements
const inputPrompt = document.body.querySelector('#input-prompt');
const buttonPrompt = document.body.querySelector('#button-prompt');
const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');
const sliderTemperature = document.body.querySelector('#temperature');
const labelTemperature = document.body.querySelector('#label-temperature');
const inputImage = document.body.querySelector('#image-input');
const selectedImagesList = document.body.querySelector('#selected-images');
const buttonClearImages = document.body.querySelector('#clear-images');
const selectedImageFiles = [];

// Debug helpers
const DEBUG = true;
function logDebug(...args) {
  if (DEBUG) console.log('[ModelMe]', ...args);
}
function logError(...args) {
  console.error('[ModelMe]', ...args);
}

// --- Generate helper using the new API ---
async function runPrompt(prompt, temperature, imageFiles) {
  const ai = initClient();
  try {
    logDebug('runPrompt start', {
      hasPrompt: !!(prompt && prompt.trim()),
      promptPreview: (prompt || '').slice(0, 80),
      temperature,
      imageCount: imageFiles && imageFiles.length ? imageFiles.length : 0,
      imageMeta: imageFiles && imageFiles.length ? Array.from(imageFiles).map(f => ({ name: f.name, type: f.type, size: f.size })) : [],
      model: MODEL_ID
    });
    const parts = [];
    if (prompt && prompt.trim()) {
      parts.push({ text: prompt.trim() });
    }
    if (imageFiles && imageFiles.length) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const inlineData = await fileToInlineData(file);
        logDebug('converted image to inlineData', { index: i, mimeType: inlineData.mimeType, dataLength: inlineData.data.length });
        parts.push({ inlineData });
      }
    }

    logDebug('sending request', { partsSummary: parts.map(p => Object.keys(p)[0]) });
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: parts.length ? parts : prompt,
      config: {
        temperature: Number(temperature) || 1,
        safetySettings,
      }
    });
    const extracted = extractTextFromResponse(response);
    logDebug('response received', {
      textLength: extracted.text.length,
      keys: Object.keys(response || {}),
      candidatesCount: Array.isArray(response.candidates) ? response.candidates.length : undefined
    });
    if (Array.isArray(response.candidates)) {
      response.candidates.forEach((c, idx) => {
        const partsInfo = (c && c.content && Array.isArray(c.content.parts))
          ? c.content.parts.map((pt, pidx) => {
              if (pt.text) return { index: pidx, type: 'text', length: pt.text.length };
              if (pt.inlineData) return { index: pidx, type: 'inlineData', mimeType: pt.inlineData.mimeType, dataLength: (pt.inlineData.data || '').length };
              return { index: pidx, type: 'other', keys: Object.keys(pt) };
            })
          : 'no parts';
        logDebug('candidate parts', { candidateIndex: idx, partsInfo });
      });
    }
    // Return only what we need to avoid SDK warnings about response.text
    return {
      candidates: response.candidates,
      modelVersion: response.modelVersion,
      responseId: response.responseId,
      usageMetadata: response.usageMetadata
    };
  } catch (e) {
    const details = (e && (e.message || e.toString())) || 'Unknown error';
    logError('Gemini request failed', { status: e && e.status, details, raw: e });
    throw new Error(`Gemini request failed${e && e.status ? ` [${e.status}]` : ''}: ${details}`);
  }
}

// --- UI wiring ---
if (sliderTemperature) {
  sliderTemperature.addEventListener('input', (event) => {
    if (labelTemperature) {
      labelTemperature.textContent = event.target.value;
    } else {
      logError('Missing #label-temperature span');
    }
    logDebug('temperature changed', { temperature: event.target.value });
  });
} else {
  logError('Missing #temperature input');
}

if (inputPrompt) {
  inputPrompt.addEventListener('input', updateRunButtonEnabled);
} else {
  logError('Missing #input-prompt textarea');
}
if (inputImage) {
  inputImage.addEventListener('change', () => {
    if (inputImage.files && inputImage.files.length) {
      for (let i = 0; i < inputImage.files.length; i++) {
        const f = inputImage.files[i];
        selectedImageFiles.push(f);
      }
      logDebug('images added', { added: inputImage.files.length, total: selectedImageFiles.length });
    }
    renderSelectedImages();
    updateRunButtonEnabled();
  });
}

if (buttonPrompt) {
  buttonPrompt.addEventListener('click', async () => {
    const prompt = inputPrompt ? inputPrompt.value.trim() : '';
    const imageFiles = selectedImageFiles.length
      ? selectedImageFiles.slice()
      : (inputImage && inputImage.files && inputImage.files.length ? Array.from(inputImage.files) : []);
    logDebug('run button clicked', { promptLength: prompt.length, imageCount: imageFiles.length });
    showLoading();
    try {
      const response = await runPrompt(prompt, sliderTemperature ? sliderTemperature.value : 1, imageFiles);
      showResponse(response);
    } catch (e) {
      showError(e);
    }
  });
} else {
  logError('Missing #button-prompt button');
}

// --- UI helpers ---
function showLoading() {
  if (elementResponse) hide(elementResponse);
  if (elementError) hide(elementError);
  if (elementLoading) show(elementLoading);
}

function showResponse(modelResponse) {
  hide(elementLoading);
  show(elementResponse);
  elementResponse.textContent = '';
  if (!modelResponse) {
    logDebug('showResponse', { message: 'empty response object' });
    return;
  }

  // Helper to render text nicely
  function renderText(text) {
    if (!text) return;
    const paragraphs = String(text).split(/\r?\n/);
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      if (paragraph) {
        elementResponse.appendChild(document.createTextNode(paragraph));
      }
      if (i < paragraphs.length - 1) {
        elementResponse.appendChild(document.createElement('BR'));
      }
    }
  }

  // Helper to render an inline image
  function renderInlineImage(mimeType, base64Data) {
    try {
      const img = document.createElement('img');
      img.src = `data:${mimeType};base64,${base64Data}`;
      img.style.maxWidth = '100%';
      img.style.display = 'block';
      img.style.marginTop = '8px';
      elementResponse.appendChild(img);
      logDebug('rendered inline image', { mimeType, dataLength: (base64Data || '').length });
    } catch (err) {
      logError('failed to render inline image', err);
    }
  }

  // If response is a plain string, render it directly
  if (typeof modelResponse === 'string') {
    logDebug('showResponse (string)');
    renderText(modelResponse);
    return;
  }

  // Otherwise expect the full response object from SDK
  const extracted = extractTextFromResponse(modelResponse);
  logDebug('showResponse (object)', {
    textLength: extracted.text.length,
    candidatesCount: Array.isArray(modelResponse.candidates) ? modelResponse.candidates.length : undefined
  });

  // Render concatenated text from candidates/parts (no SDK .text access)
  if (extracted.text) {
    renderText(extracted.text);
  }

  // Render any non-text parts (e.g., inlineData images)
  const candidates = Array.isArray(modelResponse.candidates) ? modelResponse.candidates : [];
  for (let cIndex = 0; cIndex < candidates.length; cIndex++) {
    const candidate = candidates[cIndex];
    const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts
      : [];
    for (let pIndex = 0; pIndex < parts.length; pIndex++) {
      const part = parts[pIndex];
      if (part && part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || 'application/octet-stream';
        if (/^image\//i.test(mimeType)) {
          renderInlineImage(mimeType, part.inlineData.data);
        } else {
          // Non-image inline data: show a short note
          const note = document.createElement('div');
          note.textContent = `Received inlineData (${mimeType}), length ${part.inlineData.data.length}`;
          note.style.marginTop = '8px';
          elementResponse.appendChild(note);
          logDebug('rendered non-image inlineData note', { mimeType, dataLength: part.inlineData.data.length });
        }
      }
    }
  }
}

function showError(error) {
  if (elementError) show(elementError);
  if (elementResponse) hide(elementResponse);
  if (elementLoading) hide(elementLoading);
  if (elementError) elementError.textContent = (error && error.message) ? error.message : String(error);
}

function show(element) {
  element.removeAttribute('hidden');
}

function hide(element) {
  element.setAttribute('hidden', '');
}

// Helpers for reading an image file to inlineData
function updateRunButtonEnabled() {
  const hasPrompt = !!inputPrompt.value.trim();
  const hasImage = (selectedImageFiles.length > 0) || !!(inputImage && inputImage.files && inputImage.files.length);
  logDebug('updateRunButtonEnabled', { hasPrompt, hasImage });
  if (hasPrompt || hasImage) {
    buttonPrompt.removeAttribute('disabled');
  } else {
    buttonPrompt.setAttribute('disabled', '');
  }
}

function renderSelectedImages() {
  if (!selectedImagesList) return;
  if (selectedImageFiles.length === 0) {
    selectedImagesList.textContent = '';
    hide(selectedImagesList);
    if (buttonClearImages) hide(buttonClearImages);
    return;
  }
  const items = selectedImageFiles.map((f, idx) => `${idx + 1}. ${f.name} (${Math.round(f.size / 1024)} KB)`).join('\n');
  selectedImagesList.textContent = `Selected images (${selectedImageFiles.length}):\n${items}`;
  show(selectedImagesList);
  if (buttonClearImages) show(buttonClearImages);
}

if (buttonClearImages) {
  buttonClearImages.addEventListener('click', () => {
    selectedImageFiles.length = 0;
    renderSelectedImages();
    updateRunButtonEnabled();
  });
}

async function fileToInlineData(file) {
  const base64Data = await readFileAsBase64(file);
  logDebug('fileToInlineData', { name: file.name, type: file.type, size: file.size, base64Length: base64Data.length });
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
      if (typeof result === 'string') {
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      } else {
        reject(new Error('Unexpected file reader result'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Extract concatenated text from response without touching response.text (avoids SDK warnings)
function extractTextFromResponse(modelResponse) {
  try {
    const candidates = Array.isArray(modelResponse && modelResponse.candidates) ? modelResponse.candidates : [];
    const pieces = [];
    for (let i = 0; i < candidates.length; i++) {
      const parts = candidates[i] && candidates[i].content && Array.isArray(candidates[i].content.parts)
        ? candidates[i].content.parts
        : [];
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (part && typeof part.text === 'string') {
          pieces.push(part.text);
        }
      }
    }
    return { text: pieces.join('\n') };
  } catch (err) {
    logError('extractTextFromResponse failed', err);
    return { text: '' };
  }
}
