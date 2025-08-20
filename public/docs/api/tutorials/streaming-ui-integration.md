# 🌊 Streaming UI Integration Guide

Complete guide for integrating LLM streaming responses with various UI frameworks including React, Vue, vanilla JavaScript, and mobile applications.

## Table of Contents

1. [Overview](#overview)
2. [Streaming Fundamentals](#streaming-fundamentals)
3. [React Integration](#react-integration)
4. [Vue.js Integration](#vuejs-integration)
5. [Vanilla JavaScript](#vanilla-javascript)
6. [Mobile Integration](#mobile-integration)
7. [Advanced Patterns](#advanced-patterns)
8. [Performance Optimization](#performance-optimization)
9. [Error Handling](#error-handling)

## Overview

Streaming LLM responses provides immediate feedback to users, improving perceived performance and user experience. This guide covers integration patterns for all major UI frameworks.

### Benefits of Streaming

- **Instant feedback**: Users see responses immediately
- **Better UX**: No loading spinners for long responses
- **Lower memory usage**: Process chunks as they arrive
- **Cancellable**: Users can stop generation mid-stream
- **Progressive rendering**: Display partial results

## Streaming Fundamentals

### 1. Basic Streaming Setup

```javascript
// Backend streaming endpoint
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openai', 'anthropic'],
  streaming: true
});

// Express.js streaming endpoint
app.post('/api/stream', async (req, res) => {
  const { prompt } = req.body;
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    const stream = await router.generateStream({
      prompt,
      model: 'gpt-3.5-turbo'
    });
    
    for await (const chunk of stream) {
      // Send as Server-Sent Event
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});
```

### 2. WebSocket Streaming

```javascript
// WebSocket streaming server
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const { prompt, requestId } = JSON.parse(message);
    
    try {
      const stream = await router.generateStream({
        prompt,
        model: 'gpt-3.5-turbo'
      });
      
      for await (const chunk of stream) {
        ws.send(JSON.stringify({
          requestId,
          type: 'chunk',
          data: chunk
        }));
      }
      
      ws.send(JSON.stringify({
        requestId,
        type: 'complete'
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        requestId,
        type: 'error',
        error: error.message
      }));
    }
  });
});
```

## React Integration

### 1. Custom Hook for Streaming

```jsx
// hooks/useStreamingLLM.js
import { useState, useCallback, useRef } from 'react';

export function useStreamingLLM() {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  
  const stream = useCallback(async (prompt, options = {}) => {
    // Reset state
    setResponse('');
    setError(null);
    setIsStreaming(true);
    
    // Create abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, ...options }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setIsStreaming(false);
              return;
            }
            
            try {
              const chunk = JSON.parse(data);
              
              if (chunk.error) {
                throw new Error(chunk.error);
              }
              
              setResponse(prev => prev + chunk.text);
              
              // Call optional callback
              if (options.onChunk) {
                options.onChunk(chunk);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        console.error('Streaming error:', err);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, []);
  
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);
  
  const clear = useCallback(() => {
    setResponse('');
    setError(null);
  }, []);
  
  return {
    response,
    isStreaming,
    error,
    stream,
    cancel,
    clear
  };
}
```

### 2. React Component Example

```jsx
// components/StreamingChat.jsx
import React, { useState } from 'react';
import { useStreamingLLM } from '../hooks/useStreamingLLM';
import ReactMarkdown from 'react-markdown';

export function StreamingChat() {
  const [input, setInput] = useState('');
  const { response, isStreaming, error, stream, cancel, clear } = useStreamingLLM();
  const [messages, setMessages] = useState([]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || isStreaming) return;
    
    // Add user message
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input
    const prompt = input;
    setInput('');
    
    // Start streaming
    await stream(prompt, {
      onChunk: (chunk) => {
        // Optional: Handle individual chunks
        console.log('Received chunk:', chunk);
      }
    });
    
    // Add assistant message when complete
    if (!error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response
      }]);
    }
  };
  
  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
        
        {isStreaming && (
          <div className="message assistant streaming">
            <strong>assistant:</strong>
            <ReactMarkdown>{response}</ReactMarkdown>
            <span className="typing-indicator">●●●</span>
          </div>
        )}
        
        {error && (
          <div className="error">
            Error: {error}
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isStreaming}
        />
        
        {isStreaming ? (
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        ) : (
          <button type="submit">
            Send
          </button>
        )}
      </form>
    </div>
  );
}
```

### 3. Advanced React Streaming with Context

```jsx
// contexts/StreamingContext.jsx
import React, { createContext, useContext, useReducer } from 'react';

const StreamingContext = createContext();

const initialState = {
  streams: {},  // Multiple concurrent streams
  errors: {}
};

function streamingReducer(state, action) {
  switch (action.type) {
    case 'START_STREAM':
      return {
        ...state,
        streams: {
          ...state.streams,
          [action.id]: {
            content: '',
            isStreaming: true,
            startTime: Date.now()
          }
        }
      };
    
    case 'UPDATE_STREAM':
      return {
        ...state,
        streams: {
          ...state.streams,
          [action.id]: {
            ...state.streams[action.id],
            content: state.streams[action.id].content + action.chunk
          }
        }
      };
    
    case 'END_STREAM':
      return {
        ...state,
        streams: {
          ...state.streams,
          [action.id]: {
            ...state.streams[action.id],
            isStreaming: false,
            endTime: Date.now()
          }
        }
      };
    
    case 'ERROR_STREAM':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.id]: action.error
        }
      };
    
    default:
      return state;
  }
}

export function StreamingProvider({ children }) {
  const [state, dispatch] = useReducer(streamingReducer, initialState);
  
  const startStream = async (id, prompt, options = {}) => {
    dispatch({ type: 'START_STREAM', id });
    
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              dispatch({ type: 'END_STREAM', id });
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              dispatch({ type: 'UPDATE_STREAM', id, chunk: parsed.text });
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      dispatch({ type: 'ERROR_STREAM', id, error: error.message });
    }
  };
  
  return (
    <StreamingContext.Provider value={{ state, startStream }}>
      {children}
    </StreamingContext.Provider>
  );
}

export const useStreaming = () => {
  const context = useContext(StreamingContext);
  if (!context) {
    throw new Error('useStreaming must be used within StreamingProvider');
  }
  return context;
};
```

## Vue.js Integration

### 1. Vue 3 Composition API

```vue
<!-- StreamingChat.vue -->
<template>
  <div class="streaming-chat">
    <div class="messages">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="['message', message.role]"
      >
        <strong>{{ message.role }}:</strong>
        <div v-html="renderMarkdown(message.content)"></div>
      </div>
      
      <div v-if="isStreaming" class="message assistant streaming">
        <strong>assistant:</strong>
        <div v-html="renderMarkdown(currentResponse)"></div>
        <span class="typing">●●●</span>
      </div>
    </div>
    
    <form @submit.prevent="sendMessage" class="input-form">
      <input
        v-model="input"
        :disabled="isStreaming"
        placeholder="Type your message..."
      />
      <button v-if="!isStreaming" type="submit">Send</button>
      <button v-else @click="cancelStream" type="button">Cancel</button>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { marked } from 'marked';

// Composable for streaming
function useStreaming() {
  const currentResponse = ref('');
  const isStreaming = ref(false);
  const error = ref(null);
  let abortController = null;
  
  const streamResponse = async (prompt, options = {}) => {
    currentResponse.value = '';
    error.value = null;
    isStreaming.value = true;
    
    abortController = new AbortController();
    
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options }),
        signal: abortController.signal
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              isStreaming.value = false;
              return currentResponse.value;
            }
            
            try {
              const chunk = JSON.parse(data);
              currentResponse.value += chunk.text;
              
              if (options.onChunk) {
                options.onChunk(chunk);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        error.value = err.message;
      }
    } finally {
      isStreaming.value = false;
      abortController = null;
    }
  };
  
  const cancelStream = () => {
    if (abortController) {
      abortController.abort();
      isStreaming.value = false;
    }
  };
  
  return {
    currentResponse,
    isStreaming,
    error,
    streamResponse,
    cancelStream
  };
}

// Component logic
const messages = ref([]);
const input = ref('');

const {
  currentResponse,
  isStreaming,
  error,
  streamResponse,
  cancelStream
} = useStreaming();

const sendMessage = async () => {
  if (!input.value.trim() || isStreaming.value) return;
  
  const userMessage = {
    role: 'user',
    content: input.value
  };
  
  messages.value.push(userMessage);
  
  const prompt = input.value;
  input.value = '';
  
  const response = await streamResponse(prompt);
  
  if (response && !error.value) {
    messages.value.push({
      role: 'assistant',
      content: response
    });
  }
};

const renderMarkdown = (text) => {
  return marked(text);
};
</script>

<style scoped>
.streaming-chat {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message {
  margin-bottom: 1rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
}

.message.user {
  background: #e3f2fd;
  margin-left: 20%;
}

.message.assistant {
  background: #f5f5f5;
  margin-right: 20%;
}

.streaming {
  opacity: 0.8;
}

.typing {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.input-form {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #ddd;
}

.input-form input {
  flex: 1;
  padding: 0.5rem;
  margin-right: 0.5rem;
}
</style>
```

### 2. Vue 3 Store Integration

```javascript
// stores/streaming.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useStreamingStore = defineStore('streaming', () => {
  const streams = ref(new Map());
  const activeStreamIds = computed(() => Array.from(streams.value.keys()));
  
  async function startStream(id, prompt, options = {}) {
    // Initialize stream state
    streams.value.set(id, {
      content: '',
      isStreaming: true,
      error: null,
      startTime: Date.now(),
      chunks: []
    });
    
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              updateStream(id, { isStreaming: false });
              return;
            }
            
            try {
              const chunk = JSON.parse(data);
              appendToStream(id, chunk.text);
              
              // Store chunk metadata
              const stream = streams.value.get(id);
              stream.chunks.push({
                text: chunk.text,
                timestamp: Date.now()
              });
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      updateStream(id, {
        error: error.message,
        isStreaming: false
      });
    }
  }
  
  function appendToStream(id, text) {
    const stream = streams.value.get(id);
    if (stream) {
      stream.content += text;
    }
  }
  
  function updateStream(id, updates) {
    const stream = streams.value.get(id);
    if (stream) {
      Object.assign(stream, updates);
    }
  }
  
  function clearStream(id) {
    streams.value.delete(id);
  }
  
  function getStream(id) {
    return streams.value.get(id);
  }
  
  return {
    streams,
    activeStreamIds,
    startStream,
    clearStream,
    getStream
  };
});
```

## Vanilla JavaScript

### 1. Pure JavaScript Implementation

```javascript
// streaming-client.js
class StreamingClient {
  constructor(endpoint = '/api/stream') {
    this.endpoint = endpoint;
    this.abortController = null;
  }
  
  async stream(prompt, options = {}) {
    // Cancel any existing stream
    this.cancel();
    
    // Create new abort controller
    this.abortController = new AbortController();
    
    const {
      onChunk = () => {},
      onComplete = () => {},
      onError = () => {},
      model = 'gpt-3.5-turbo',
      temperature = 0.7
    } = options;
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model,
          temperature
        }),
        signal: this.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete(fullResponse);
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              onComplete(fullResponse);
              return;
            }
            
            try {
              const chunk = JSON.parse(data);
              
              if (chunk.error) {
                throw new Error(chunk.error);
              }
              
              fullResponse += chunk.text;
              onChunk(chunk.text, fullResponse);
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        onError(error);
      }
    } finally {
      this.abortController = null;
    }
  }
  
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

// Usage example
const client = new StreamingClient();

// HTML elements
const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const sendBtn = document.getElementById('send');
const cancelBtn = document.getElementById('cancel');

sendBtn.addEventListener('click', async () => {
  const prompt = inputEl.value;
  if (!prompt) return;
  
  // Clear output
  outputEl.textContent = '';
  
  // Disable input
  inputEl.disabled = true;
  sendBtn.disabled = true;
  cancelBtn.disabled = false;
  
  await client.stream(prompt, {
    onChunk: (chunk, full) => {
      // Append chunk to output
      outputEl.textContent = full;
      
      // Auto-scroll to bottom
      outputEl.scrollTop = outputEl.scrollHeight;
    },
    onComplete: (response) => {
      console.log('Streaming complete:', response);
      
      // Re-enable input
      inputEl.disabled = false;
      sendBtn.disabled = false;
      cancelBtn.disabled = true;
    },
    onError: (error) => {
      console.error('Streaming error:', error);
      outputEl.textContent = `Error: ${error.message}`;
      
      // Re-enable input
      inputEl.disabled = false;
      sendBtn.disabled = false;
      cancelBtn.disabled = true;
    }
  });
});

cancelBtn.addEventListener('click', () => {
  client.cancel();
  cancelBtn.disabled = true;
  sendBtn.disabled = false;
  inputEl.disabled = false;
});
```

### 2. Web Components

```javascript
// streaming-chat-element.js
class StreamingChat extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.client = new StreamingClient();
    this.messages = [];
  }
  
  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: #f5f5f5;
        }
        
        .message {
          margin-bottom: 1rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          background: white;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .message.user {
          background: #e3f2fd;
          margin-left: 20%;
        }
        
        .message.assistant {
          background: white;
          margin-right: 20%;
        }
        
        .message.streaming {
          opacity: 0.8;
          position: relative;
        }
        
        .message.streaming::after {
          content: '●●●';
          position: absolute;
          bottom: 0.5rem;
          right: 0.5rem;
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        
        .input-area {
          display: flex;
          padding: 1rem;
          background: white;
          border-top: 1px solid #ddd;
        }
        
        input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 0.25rem;
          font-size: 1rem;
        }
        
        button {
          margin-left: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 1rem;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        button.cancel {
          background: #f44336;
        }
      </style>
      
      <div class="messages" id="messages"></div>
      
      <div class="input-area">
        <input 
          type="text" 
          id="input" 
          placeholder="Type your message..."
        />
        <button id="send">Send</button>
        <button id="cancel" class="cancel" style="display: none;">Cancel</button>
      </div>
    `;
  }
  
  setupEventListeners() {
    const input = this.shadowRoot.getElementById('input');
    const sendBtn = this.shadowRoot.getElementById('send');
    const cancelBtn = this.shadowRoot.getElementById('cancel');
    const messagesEl = this.shadowRoot.getElementById('messages');
    
    // Send message
    const sendMessage = async () => {
      const prompt = input.value.trim();
      if (!prompt) return;
      
      // Add user message
      this.addMessage('user', prompt);
      input.value = '';
      
      // Show streaming message
      const streamingId = this.addStreamingMessage();
      
      // Update UI
      input.disabled = true;
      sendBtn.style.display = 'none';
      cancelBtn.style.display = 'block';
      
      await this.client.stream(prompt, {
        onChunk: (chunk, full) => {
          this.updateStreamingMessage(streamingId, full);
        },
        onComplete: (response) => {
          this.finalizeStreamingMessage(streamingId, response);
          
          // Reset UI
          input.disabled = false;
          sendBtn.style.display = 'block';
          cancelBtn.style.display = 'none';
          input.focus();
        },
        onError: (error) => {
          this.updateStreamingMessage(streamingId, `Error: ${error.message}`);
          
          // Reset UI
          input.disabled = false;
          sendBtn.style.display = 'block';
          cancelBtn.style.display = 'none';
        }
      });
    };
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    cancelBtn.addEventListener('click', () => {
      this.client.cancel();
      input.disabled = false;
      sendBtn.style.display = 'block';
      cancelBtn.style.display = 'none';
    });
  }
  
  addMessage(role, content) {
    const messagesEl = this.shadowRoot.getElementById('messages');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    messageEl.textContent = content;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    this.messages.push({ role, content });
    
    return messageEl;
  }
  
  addStreamingMessage() {
    const messagesEl = this.shadowRoot.getElementById('messages');
    const messageEl = document.createElement('div');
    messageEl.className = 'message assistant streaming';
    messageEl.id = `streaming-${Date.now()}`;
    messagesEl.appendChild(messageEl);
    
    return messageEl.id;
  }
  
  updateStreamingMessage(id, content) {
    const messageEl = this.shadowRoot.getElementById(id);
    if (messageEl) {
      messageEl.textContent = content;
      
      // Auto-scroll
      const messagesEl = this.shadowRoot.getElementById('messages');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }
  
  finalizeStreamingMessage(id, content) {
    const messageEl = this.shadowRoot.getElementById(id);
    if (messageEl) {
      messageEl.classList.remove('streaming');
      messageEl.textContent = content;
      
      this.messages.push({ role: 'assistant', content });
    }
  }
}

// Register custom element
customElements.define('streaming-chat', StreamingChat);
```

## Mobile Integration

### 1. React Native

```jsx
// StreamingChat.jsx (React Native)
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet
} from 'react-native';

export function StreamingChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollViewRef = useRef();
  const abortControllerRef = useRef();
  
  const streamMessage = async (prompt) => {
    setIsStreaming(true);
    setCurrentResponse('');
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch('https://api.example.com/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
        signal: abortControllerRef.current.signal
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Add complete message
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: fullResponse
              }]);
              setCurrentResponse('');
              setIsStreaming(false);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              fullResponse += parsed.text;
              setCurrentResponse(fullResponse);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Streaming error:', error);
      }
    } finally {
      setIsStreaming(false);
    }
  };
  
  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    
    const prompt = input;
    setInput('');
    streamMessage(prompt);
  };
  
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        onContentSizeChange={() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }}
      >
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.message,
              msg.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text style={styles.messageText}>{msg.content}</Text>
          </View>
        ))}
        
        {isStreaming && currentResponse && (
          <View style={[styles.message, styles.assistantMessage, styles.streaming]}>
            <Text style={styles.messageText}>{currentResponse}</Text>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}
      </ScrollView>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message..."
          editable={!isStreaming}
          onSubmitEditing={handleSend}
        />
        
        {isStreaming ? (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  message: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
  },
  streaming: {
    opacity: 0.8,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
  },
  cancelButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## Advanced Patterns

### 1. Streaming with Retry and Fallback

```javascript
class ResilientStreamingClient {
  constructor(options = {}) {
    this.primary = options.primaryEndpoint || '/api/stream';
    this.fallback = options.fallbackEndpoint || '/api/stream-fallback';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }
  
  async streamWithRetry(prompt, options = {}, attempt = 0) {
    const endpoint = attempt === 0 ? this.primary : this.fallback;
    
    try {
      await this.stream(endpoint, prompt, options);
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.log(`Retry attempt ${attempt + 1}/${this.maxRetries}`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        
        // Retry with exponential backoff
        this.retryDelay *= 2;
        
        return this.streamWithRetry(prompt, options, attempt + 1);
      }
      
      throw error;
    }
  }
  
  async stream(endpoint, prompt, options) {
    const {
      onChunk = () => {},
      onComplete = () => {},
      onError = () => {},
      onRetry = () => {},
      timeout = 30000
    } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let lastChunkTime = Date.now();
      
      // Monitor for stalled streams
      const stallMonitor = setInterval(() => {
        if (Date.now() - lastChunkTime > 5000) {
          console.warn('Stream appears stalled');
          controller.abort();
        }
      }, 1000);
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          clearInterval(stallMonitor);
          onComplete(fullResponse);
          break;
        }
        
        lastChunkTime = Date.now();
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              clearInterval(stallMonitor);
              onComplete(fullResponse);
              return;
            }
            
            try {
              const chunk = JSON.parse(data);
              fullResponse += chunk.text;
              onChunk(chunk.text, fullResponse);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      onError(error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

### 2. Streaming with Progress Tracking

```javascript
class ProgressTrackingStream {
  constructor() {
    this.metrics = {
      startTime: null,
      endTime: null,
      firstChunkTime: null,
      totalChunks: 0,
      totalBytes: 0,
      totalTokens: 0
    };
  }
  
  async stream(prompt, options = {}) {
    const {
      onProgress = () => {},
      onMetrics = () => {},
      ...streamOptions
    } = options;
    
    this.resetMetrics();
    this.metrics.startTime = Date.now();
    
    return this.streamWithProgress(prompt, {
      ...streamOptions,
      onChunk: (chunk, full) => {
        this.updateMetrics(chunk);
        
        const progress = this.calculateProgress();
        onProgress(progress);
        
        if (streamOptions.onChunk) {
          streamOptions.onChunk(chunk, full);
        }
      },
      onComplete: (response) => {
        this.metrics.endTime = Date.now();
        
        const finalMetrics = this.getFinalMetrics();
        onMetrics(finalMetrics);
        
        if (streamOptions.onComplete) {
          streamOptions.onComplete(response);
        }
      }
    });
  }
  
  resetMetrics() {
    this.metrics = {
      startTime: null,
      endTime: null,
      firstChunkTime: null,
      totalChunks: 0,
      totalBytes: 0,
      totalTokens: 0
    };
  }
  
  updateMetrics(chunk) {
    if (!this.metrics.firstChunkTime) {
      this.metrics.firstChunkTime = Date.now();
    }
    
    this.metrics.totalChunks++;
    this.metrics.totalBytes += new TextEncoder().encode(chunk).length;
    this.metrics.totalTokens += this.estimateTokens(chunk);
  }
  
  calculateProgress() {
    const elapsed = Date.now() - this.metrics.startTime;
    const tokensPerSecond = this.metrics.totalTokens / (elapsed / 1000);
    
    return {
      elapsed,
      chunks: this.metrics.totalChunks,
      tokens: this.metrics.totalTokens,
      tokensPerSecond: Math.round(tokensPerSecond),
      estimatedCompletion: this.estimateCompletion()
    };
  }
  
  estimateCompletion() {
    // Estimate based on typical response length
    const avgResponseTokens = 200;
    const currentRate = this.metrics.totalTokens / 
                       ((Date.now() - this.metrics.startTime) / 1000);
    
    if (currentRate === 0) return null;
    
    const remainingTokens = Math.max(0, avgResponseTokens - this.metrics.totalTokens);
    const remainingTime = remainingTokens / currentRate;
    
    return Math.round(remainingTime * 1000); // ms
  }
  
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  getFinalMetrics() {
    const duration = this.metrics.endTime - this.metrics.startTime;
    const timeToFirstChunk = this.metrics.firstChunkTime - this.metrics.startTime;
    
    return {
      ...this.metrics,
      duration,
      timeToFirstChunk,
      avgChunkSize: this.metrics.totalBytes / this.metrics.totalChunks,
      tokensPerSecond: this.metrics.totalTokens / (duration / 1000)
    };
  }
}
```

## Performance Optimization

### 1. Buffering and Debouncing

```javascript
class OptimizedStreamRenderer {
  constructor(options = {}) {
    this.bufferSize = options.bufferSize || 10;
    this.debounceMs = options.debounceMs || 50;
    this.buffer = [];
    this.debounceTimer = null;
  }
  
  handleChunk(chunk, targetElement) {
    // Add to buffer
    this.buffer.push(chunk);
    
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Render immediately if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flush(targetElement);
    } else {
      // Otherwise debounce
      this.debounceTimer = setTimeout(() => {
        this.flush(targetElement);
      }, this.debounceMs);
    }
  }
  
  flush(targetElement) {
    if (this.buffer.length === 0) return;
    
    // Batch DOM update
    const fragment = document.createDocumentFragment();
    const text = this.buffer.join('');
    const textNode = document.createTextNode(text);
    fragment.appendChild(textNode);
    
    targetElement.appendChild(fragment);
    
    // Clear buffer
    this.buffer = [];
    
    // Auto-scroll
    targetElement.scrollTop = targetElement.scrollHeight;
  }
}
```

### 2. Virtual Scrolling for Long Streams

```jsx
// VirtualStreamingList.jsx
import { useVirtual } from '@tanstack/react-virtual';

function VirtualStreamingList({ messages, currentStream }) {
  const parentRef = useRef();
  
  const rowVirtualizer = useVirtual({
    size: messages.length + (currentStream ? 1 : 0),
    parentRef,
    estimateSize: useCallback(() => 100, []),
    overscan: 5
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${rowVirtualizer.totalSize}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.virtualItems.map(virtualRow => {
          const isStreaming = virtualRow.index === messages.length;
          const content = isStreaming 
            ? currentStream 
            : messages[virtualRow.index].content;
          
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <div className={isStreaming ? 'streaming' : ''}>
                {content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## Error Handling

### 1. Comprehensive Error Recovery

```javascript
class StreamErrorHandler {
  constructor() {
    this.errorStrategies = {
      'NetworkError': this.handleNetworkError,
      'TimeoutError': this.handleTimeoutError,
      'RateLimitError': this.handleRateLimitError,
      'ServerError': this.handleServerError
    };
  }
  
  async handleStreamError(error, context) {
    const errorType = this.classifyError(error);
    const strategy = this.errorStrategies[errorType];
    
    if (strategy) {
      return strategy.call(this, error, context);
    }
    
    return this.handleGenericError(error, context);
  }
  
  classifyError(error) {
    if (error.name === 'AbortError' || error.message.includes('network')) {
      return 'NetworkError';
    }
    if (error.message.includes('timeout')) {
      return 'TimeoutError';
    }
    if (error.status === 429) {
      return 'RateLimitError';
    }
    if (error.status >= 500) {
      return 'ServerError';
    }
    return 'GenericError';
  }
  
  async handleNetworkError(error, context) {
    const { onError, onRetry } = context;
    
    onError({
      type: 'network',
      message: 'Connection lost. Retrying...',
      recoverable: true
    });
    
    // Wait and retry
    await this.wait(2000);
    onRetry();
  }
  
  async handleTimeoutError(error, context) {
    const { onError, onRetry, prompt } = context;
    
    onError({
      type: 'timeout',
      message: 'Request timed out. Trying with shorter response...',
      recoverable: true
    });
    
    // Retry with modified parameters
    onRetry({
      prompt: prompt + ' (Please provide a concise response)',
      maxTokens: 200
    });
  }
  
  async handleRateLimitError(error, context) {
    const { onError } = context;
    const retryAfter = error.headers?.get('Retry-After') || 60;
    
    onError({
      type: 'rate_limit',
      message: `Rate limit reached. Please wait ${retryAfter} seconds.`,
      recoverable: true,
      retryAfter
    });
  }
  
  async handleServerError(error, context) {
    const { onError, onFallback } = context;
    
    onError({
      type: 'server',
      message: 'Server error. Switching to backup provider...',
      recoverable: true
    });
    
    // Switch to fallback provider
    if (onFallback) {
      onFallback();
    }
  }
  
  handleGenericError(error, context) {
    const { onError } = context;
    
    onError({
      type: 'generic',
      message: error.message || 'An unexpected error occurred',
      recoverable: false
    });
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Best Practices

1. **Always implement cancellation** - Users should be able to stop streaming
2. **Buffer rendering** - Don't update DOM on every chunk
3. **Handle connection loss** - Implement retry logic
4. **Show progress indicators** - Display streaming status
5. **Validate chunks** - Check for malformed data
6. **Monitor performance** - Track streaming metrics
7. **Implement timeouts** - Prevent indefinite waits
8. **Use virtual scrolling** - For long conversations
9. **Cache partial responses** - Save incomplete streams
10. **Provide fallback UI** - Show alternative when streaming fails

## Conclusion

Implementing streaming UI integration requires careful handling of real-time data, error scenarios, and performance optimization. By following the patterns in this guide, you can create responsive, resilient streaming interfaces across all platforms.

---

Next: [Function Calling Patterns](./function-calling-patterns.md) | [Back to Tutorials](../tutorials/)