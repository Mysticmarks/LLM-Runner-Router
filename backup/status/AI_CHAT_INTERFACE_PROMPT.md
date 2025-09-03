# ChatGPT-Style LLM Router Interface - Build Instructions

Create a modern, professional chat interface modeled after ChatGPT but enhanced with LLM Router capabilities.

## Interface Architecture

### Layout Structure (ChatGPT-inspired)
```
[Sidebar 260px] | [Main Chat Area] | [Settings Panel - collapsible]
|               |                  |
| - New Chat    | Header Bar       | Model Settings
| - Chat History| Messages Area    | Advanced Options  
| - Models      | Input Zone       | Tools & Plugins
| - Tools       |                  |
| - Settings    |                  |
```

### Left Sidebar (ChatGPT-style)
- **New Chat Button** (prominent, top of sidebar)
- **Chat History** (scrollable list with search)
- **Model Selector** (dropdown showing current model)
- **Tools & Plugins** (expandable section)
- **Settings** (gear icon at bottom)
- **Account/Profile** (if applicable)

### Main Header Bar
- **Current Model Badge** (clickable to switch)
- **Conversation Title** (editable)
- **Share Button** 
- **Settings Toggle** (to show/hide right panel)

### Chat Input Zone (Bottom)
- **Large Text Area** (multi-line, auto-expanding)
- **Tools Menu Trigger** ("+" button or "@" trigger in input)
- **File Upload Button** (paperclip icon)
- **Voice Input Button** (microphone icon) 
- **Image Upload Button** (image icon)
- **Send Button** (arrow icon, disabled when empty)
- **Character/Token Counter** (small text below)

#### Tools & MCP Menu (Claude-style)
- **Trigger Methods**:
  - "@" symbol typed in input field (autocomplete dropdown)
  - "+" button click (full menu overlay)
  - "/" for slash commands

- **Menu Appearance**: 
  - Floating popup above input area
  - Search/filter functionality
  - Keyboard navigation support
  - ESC to close, Enter to select

- **Available Options**:
  - **@models** - Switch model mid-conversation (`@models gpt-4`, `@models claude`)
  - **@tools** - Access available tools (`@tools search`, `@tools code`)
  - **@mcp** - Model Context Protocol integrations (`@mcp filesystem`, `@mcp database`)
  - **@files** - Recent/attached files (`@files document.pdf`)
  - **@settings** - Quick setting adjustments (`@settings temp 0.8`)
  - **@plugins** - Available plugins and extensions

- **Slash Commands**:
  - `/help` - Show available commands
  - `/clear` - Clear current conversation
  - `/export` - Export conversation
  - `/new` - Start new conversation
  - `/model [name]` - Switch to specific model
  - `/temp [value]` - Set temperature
  - `/tokens [value]` - Set max tokens

## Required Functionality

### Core Chat Features
- **Conversation Management**
  - New chat creation
  - Chat history sidebar with search
  - Conversation naming/renaming
  - Delete conversations
  - Export conversations (JSON/markdown)

### Model Management
- **Model Switcher**
  - Dropdown in header showing current model
  - Model categories (Local, API, Specialized)
  - Model status indicators (online/offline/loading)
  - Model capabilities display (text, code, multimodal)
  - Switch mid-conversation with context preservation

### Input Methods
- **Text Input**
  - Multi-line textarea with auto-expand
  - Markdown support preview
  - Slash commands (/help, /clear, etc.)
  - @ mentions for model switching

- **Voice Input** 
  - Click-to-record button
  - Real-time transcription display
  - Language selection
  - Push-to-talk mode

- **File Uploads**
  - Drag-and-drop support
  - Multiple file types (txt, pdf, csv, json)
  - File preview/thumbnail
  - Processing status indicators

- **Image Uploads**
  - Image preview thumbnails
  - OCR text extraction
  - Vision model routing
  - Image annotation tools

### Advanced Settings Panel (Right Sidebar)

#### Model Configuration
- **Temperature Slider** (0.0 - 1.0)
- **Max Tokens Input** (numeric field)
- **Top-p Slider** (nucleus sampling)
- **Frequency Penalty** (slider)
- **Presence Penalty** (slider)
- **Stop Sequences** (text input)

#### Routing Strategy
- **Strategy Selector** (dropdown)
  - Balanced
  - Quality First
  - Speed Priority
  - Cost Optimized
  - Custom
- **Fallback Models** (multi-select)
- **Timeout Settings** (numeric input)

#### Tools & Extensions
- **Available Tools** (checkbox list)
  - Web Search
  - Code Execution
  - Image Generation
  - Document Analysis
  - Custom Plugins
- **Tool Configuration** (per-tool settings)

#### Performance Monitoring
- **Real-time Metrics Toggle**
- **Response Time Display**
- **Token Usage Tracking**
- **Cost Monitoring** (if applicable)
- **Cache Hit Rate**

## Technical Implementation

### Frontend Stack
```
Framework: React 18+ or Vue 3
Styling: Tailwind CSS
State: Zustand or Pinia  
WebSocket: Socket.io-client
File Upload: react-dropzone
Voice: Web Speech API
Charts: Recharts (for metrics)
```

### Key Components

#### Chat Components
- `ConversationList` - Sidebar chat history
- `MessageContainer` - Main chat area
- `MessageBubble` - Individual messages
- `TypingIndicator` - Animated dots
- `InputArea` - Bottom input zone

#### UI Components  
- `ModelSelector` - Model switching dropdown
- `SettingsPanel` - Right sidebar settings
- `FileUploader` - Drag-and-drop file area
- `VoiceRecorder` - Voice input component
- `ToolsPalette` - Available tools/plugins
- `CommandMenu` - "@" and "/" command autocomplete
- `MCPIntegration` - Model Context Protocol handler

### API Integration
```javascript
// Core endpoints
POST /api/chat/send          - Send message
GET  /api/chat/history       - Get conversations  
POST /api/chat/new           - Create new chat
DELETE /api/chat/{id}        - Delete conversation

// Model management
GET  /api/models             - List available models
POST /api/models/switch      - Change active model
GET  /api/models/{id}/status - Model availability

// File handling  
POST /api/files/upload       - Upload files
POST /api/images/upload      - Upload images
POST /api/files/process      - Process uploaded files

// Voice
POST /api/voice/transcribe   - Convert speech to text
POST /api/voice/synthesize   - Convert text to speech

// Tools & plugins
GET  /api/tools              - List available tools
POST /api/tools/{id}/execute - Execute tool function
```

### Advanced Features

#### Plugin System
- **Tool Registration** - Dynamic tool loading
- **Custom Actions** - User-defined functions
- **API Integrations** - Third-party service connections
- **Workflow Automation** - Multi-step processes

#### Collaboration Features
- **Share Conversations** - Generate shareable links
- **Collaboration Mode** - Multiple users in chat
- **Comments/Annotations** - Message threading
- **Version History** - Conversation revisions

#### Accessibility
- **Keyboard Navigation** - Full keyboard support
- **Screen Reader** - ARIA labels and descriptions
- **High Contrast Mode** - Accessibility color themes
- **Font Size Scaling** - User-adjustable text size

## UI/UX Requirements

### Design Principles
- **Clean & Minimal** - Focus on content, not interface
- **Responsive Design** - Works on all screen sizes
- **Fast & Smooth** - 60fps animations, instant feedback
- **Professional** - Business/enterprise appropriate
- **Familiar** - Similar to ChatGPT/Claude patterns

### Color Scheme (Professional)
```css
--bg-primary: #ffffff
--bg-secondary: #f7f7f8  
--bg-tertiary: #ececf1
--text-primary: #2d2d2d
--text-secondary: #6e6e80
--accent-primary: #10a37f
--accent-hover: #0d8c6c
--border-light: #e5e5e5
--error: #ef4444
--warning: #f59e0b
```

### Dark Mode Support
```css
--bg-primary: #343541
--bg-secondary: #444654
--bg-tertiary: #202123
--text-primary: #ececf1
--text-secondary: #c5c5d2
--accent-primary: #10a37f
--border-light: #4d4d4f
```

This creates a professional, feature-rich interface that matches modern AI chat applications while leveraging the LLM Router's unique capabilities.