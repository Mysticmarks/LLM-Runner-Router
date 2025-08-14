# Admin Panel Guide

## Overview

The LLM Router Chat Interface now includes a comprehensive admin settings panel with full control over model parameters, chat templates, and system instructions.

## Access

- **URL**: http://178.156.181.117:3000/chat/admin.html
- **Access from Chat**: Click the "⚙️ Settings" button in the main chat interface

## Features

### 1. Model Controls
- **Model Selection**: Choose between auto-routing or specific models
- **Generation Parameters**:
  - Temperature (0-2): Controls randomness
  - Max Tokens (1-4096): Maximum response length
  - Top P (0-1): Nucleus sampling threshold
  - Top K (1-100): Vocabulary limitation
  - Repetition Penalty (0.5-2): Prevents repetition
  - Context Size (512-8192): Model context window
- **Routing Strategy**: balanced, quality-first, speed-priority, cost-optimized

### 2. Chat Templates
Pre-configured templates for different model formats:
- **Default**: Standard format with ### prefixes
- **Alpaca**: Instruction/Input/Response format
- **ChatML**: OpenAI-style with special tokens
- **Llama**: Meta's Llama format with [INST] tags
- **Vicuna**: USER/ASSISTANT format
- **Custom**: Create your own templates

Template components:
- System prefix
- User prefix
- Assistant prefix
- Message separator
- Stop sequences

### 3. System Instructions
**Preset Personalities**:
- 🤝 **Helpful Assistant**: Professional and accurate
- 🎨 **Creative Writer**: Imaginative storytelling
- 💻 **Technical Expert**: Programming and engineering
- 📚 **Teacher**: Educational and patient
- 📊 **Data Analyst**: Analytical and precise
- 🌍 **Translator**: Multilingual support

**Behavior Settings**:
- Enable/disable system prompt
- Maintain conversation context
- Stream responses
- Show token count
- Enable response cache

### 4. Advanced Parameters

**Sampling Parameters**:
- Min Length
- Presence Penalty
- Frequency Penalty
- Seed (for reproducibility)

**Performance Settings**:
- Batch Size
- Thread Count
- GPU Layers
- Timeout

**Memory Management**:
- Cache Size (MB)
- Cache TTL (seconds)
- Max Concurrent Requests

### 5. System Monitoring

**Real-time Metrics**:
- Model status
- Memory usage
- Requests processed
- Average latency

**Features**:
- Performance history chart
- System logs viewer
- Auto-scroll logs
- Download logs

## Configuration Management

### Save/Load
- **Save**: Stores configuration locally and to server
- **Export**: Download configuration as JSON
- **Import**: Load configuration from file

### Template Management
- Save custom templates
- Load preset templates
- Delete saved templates
- Preview template format

## API Endpoints

The admin panel communicates with these endpoints:
- `GET /api/config` - Get current configuration
- `POST /api/config` - Save configuration
- `GET /api/models` - List available models
- `GET /api/status` - System status
- `GET /api/diagnostics` - System diagnostics

## Usage Examples

### Setting Up for Creative Writing
1. Go to System Instructions
2. Click "Creative Writer" preset
3. Adjust temperature to 1.2 for more creativity
4. Increase max tokens to 1000
5. Save configuration

### Optimizing for Speed
1. Go to Model Controls
2. Set Routing Strategy to "Speed Priority"
3. Reduce context size to 1024
4. Lower max tokens to 200
5. Save configuration

### Custom Chat Template
1. Go to Chat Templates
2. Select "Custom"
3. Set your prefixes:
   - System: `[SYSTEM]`
   - User: `[USER]`
   - Assistant: `[AI]`
4. Set separator: `\n---\n`
5. Save template with a name

## Responsive Design

The admin panel is fully responsive:
- Desktop: Full sidebar navigation
- Tablet: Collapsible sidebar
- Mobile: Hamburger menu navigation

## Dark Theme

The panel uses a dark theme optimized for:
- Reduced eye strain
- Better contrast
- Professional appearance
- Energy efficiency on OLED screens

## Troubleshooting

### Settings Not Saving
- Check browser console for errors
- Ensure localStorage is enabled
- Verify server is running

### Models Not Loading
- Check `/api/models` endpoint
- Verify server has models loaded
- Refresh the models list

### Template Preview Not Updating
- Check for JavaScript errors
- Ensure all fields are filled
- Try refreshing the page

## Security

- API endpoints require authentication (when enabled)
- Configuration stored in localStorage
- Server-side validation for all parameters
- No sensitive data in client-side storage

---

*Admin Panel Version 1.0 - August 14, 2025*