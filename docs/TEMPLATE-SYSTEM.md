# Model Template Auto-Population System

## Overview
The LLM Router now includes an intelligent template auto-selection system that automatically configures the correct chat template format for each model type.

## Features

### 🎯 Auto-Detection
- Automatically detects model type from ID and name
- Selects appropriate chat template without manual configuration
- Supports 10+ model architectures out of the box

### 📋 Supported Model Templates

1. **TinyLlama** - `<|system|>`, `<|user|>`, `<|assistant|>` format
2. **Phi** - Microsoft Phi instruction format
3. **Mistral/Mixtral** - `[INST]` format
4. **Llama 2** - Meta's Llama instruction format
5. **CodeLlama** - Specialized coding assistant format
6. **Alpaca/Vicuna** - Stanford's instruction format
7. **Wizard** - WizardLM format
8. **Orca** - Microsoft Orca format
9. **StableLM** - Stability AI format
10. **ChatML** - OpenAI compatible format
11. **Default** - Generic fallback format

### 🔧 How It Works

1. **Model Selection**: When a user selects a model in the admin panel
2. **Pattern Matching**: System analyzes model ID and name
3. **Template Selection**: Appropriate template is automatically selected
4. **Configuration Update**: Template settings are applied and saved
5. **Persistence**: Settings persist across sessions

### 📁 Implementation Files

- `/src/config/ModelTemplates.js` - Server-side template definitions
- `/public/chat/model-templates.js` - Client-side template mappings
- `/public/chat/admin.js` - Admin panel integration

### 🧪 Testing

Run the template selection test:
```bash
node test-template-selection.js
```

Access the integration test page:
```
http://localhost:3000/chat/test-admin-integration.html
```

### 💡 Usage Example

```javascript
// Automatic template selection
const modelId = 'tinyllama-1.1b-chat';
const template = ModelTemplates.getTemplateForModel(modelId);
// Returns TinyLlama template with correct prefixes

// Format a conversation
const messages = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' }
];
const formatted = ModelTemplates.formatConversation(messages, modelId);
```

### 🎛️ Admin Panel Integration

The admin panel now:
- Shows all available templates in a dropdown
- Auto-selects the correct template when switching models
- Displays template preview with actual formatting
- Saves template configuration with model selection
- Allows custom template creation and management

### ✅ Benefits

1. **Zero Configuration** - Works automatically for known models
2. **Better Accuracy** - Correct formatting improves model responses
3. **Time Saving** - No manual template configuration needed
4. **Extensible** - Easy to add new model templates
5. **User Friendly** - Seamless experience in admin panel

## Adding New Templates

To add support for a new model type:

1. Add template definition to `/src/config/ModelTemplates.js`
2. Add client-side mapping to `/public/chat/model-templates.js`
3. Add model ID pattern matching if needed

Example:
```javascript
newmodel: {
    name: 'NewModel',
    systemPrefix: 'System: ',
    userPrefix: 'User: ',
    assistantPrefix: 'Assistant: ',
    messageSeparator: '\n',
    stopSequences: ['User:', 'System:']
}
```

## Troubleshooting

- If a model doesn't auto-select the correct template, check the model ID pattern matching
- Custom templates are saved in localStorage and persist across sessions
- The default template is used as fallback for unknown models