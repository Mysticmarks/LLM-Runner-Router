# 🤖 Model Manager Guide

## Overview

The LLM Router includes a comprehensive Model Manager that allows you to download, manage, and switch between different GGUF models from HuggingFace. This guide covers all features and capabilities.

## Access Points

- **Model Manager UI**: http://178.156.181.117:3006/chat/model-selector.html
- **Chat Interface**: http://178.156.181.117:3006/chat/
- **Admin Panel**: http://178.156.181.117:3006/chat/admin.html

## Features

### 1. Model Download System

#### Available Models
The system comes pre-configured with 8 popular GGUF models:

| Model | Size | Type | Context | Description |
|-------|------|------|---------|-------------|
| **TinyLlama 1.1B Chat** | 637 MB | Chat | 2048 | Compact chat model, great for testing |
| **Phi-2 2.7B** | 1.6 GB | Instruct | 2048 | Microsoft Phi-2 for reasoning |
| **Mistral 7B Instruct** | 4.1 GB | Instruct | 8192 | Powerful instruction-following |
| **Llama 2 7B Chat** | 3.8 GB | Chat | 4096 | Meta's Llama 2 chat model |
| **CodeLlama 7B** | 3.8 GB | Code | 4096 | Specialized for code generation |
| **Wizard Vicuna 7B** | 3.8 GB | Chat | 2048 | Enhanced chat capabilities |
| **Orca Mini 3B** | 1.9 GB | General | 2048 | Efficient general-purpose |
| **StableLM 3B** | 1.8 GB | General | 4096 | Stability AI language model |

#### Download Process
1. Navigate to Model Manager
2. Click on any model card to select it
3. Click "Download Model" button
4. Monitor progress in real-time with:
   - Progress percentage
   - Download speed (MB/s)
   - Downloaded/Total size
5. Model is automatically available after download

### 2. Model Management

#### Loading Models
- Downloaded models can be loaded into memory
- Click "Load Model" to activate for inference
- Multiple models can be downloaded but only one active at a time

#### Unloading Models
- Free up memory by unloading unused models
- Click "Unload Model" when switching between models
- Model files remain on disk after unloading

#### Deleting Models
- Remove downloaded models to free disk space
- Confirmation required before deletion
- Cannot delete currently loaded models

### 3. Model Filtering & Search

#### Filter Options
- **By Size**: Small (<1GB), Medium (1-3GB), Large (3-7GB), Extra Large (>7GB)
- **By Type**: Chat, Instruct, Code, General Purpose
- **Search**: Real-time search by model name or description

### 4. Storage Management

#### Storage Information
- Total storage used by all models
- Number of downloaded models
- Individual model sizes
- Last modified dates

#### Storage API
```bash
# Check storage usage
curl http://178.156.181.117:3006/api/models/storage

# Response:
{
  "used": 670145439,
  "usedMB": "639.10",
  "usedGB": "0.62",
  "modelCount": 1
}
```

## API Endpoints

### Model Management

#### List Downloaded Models
```bash
GET /api/models/downloaded
```

#### Download a Model
```bash
POST /api/models/download
Content-Type: application/json

{
  "modelId": "tinyllama-1.1b",
  "url": "https://huggingface.co/..."
}
```

#### Check Download Progress
```bash
GET /api/models/download/progress
```

#### Load a Model
```bash
POST /api/models/load
Content-Type: application/json

{
  "modelId": "tinyllama-1.1b",
  "path": "models/tinyllama-1.1b/model.gguf"
}
```

#### Unload a Model
```bash
POST /api/models/unload
Content-Type: application/json

{
  "modelId": "tinyllama-1.1b"
}
```

#### Delete a Model
```bash
DELETE /api/models/{modelId}
```

#### Switch Active Model
```bash
POST /api/models/switch
Content-Type: application/json

{
  "modelId": "tinyllama-1.1b"
}
```

## File Structure

Downloaded models are stored in:
```
/home/mikecerqua/projects/LLM-Runner-Router/models/
├── tinyllama/
│   └── tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
├── phi-2/
│   └── phi-2.Q4_K_M.gguf
├── mistral-7b-instruct/
│   └── mistral-7b-instruct-v0.2.Q4_K_M.gguf
└── ...
```

## Performance Considerations

### Memory Usage
- Each loaded model consumes RAM based on its size
- Q4_K_M quantization reduces memory by ~75% vs full precision
- Recommended: Unload models when switching

### CPU Optimization
- Models use optimized thread count (CPUs - 1)
- Batch size configured for VPS performance
- Context size limited to reduce memory usage

### Download Speed
- Downloads directly from HuggingFace CDN
- Speed depends on network connection
- Progress tracking updates every second
- Partial downloads can be resumed

## Troubleshooting

### Common Issues

#### Model Won't Load
- Check if model is fully downloaded
- Verify sufficient RAM available
- Check PM2 logs: `pm2 logs llm-router-http`

#### Download Stuck
- Cancel and retry download
- Check network connectivity
- Verify HuggingFace is accessible

#### High Memory Usage
- Unload unused models
- Restart server: `pm2 restart llm-router-http`
- Consider smaller models for limited RAM

### Debug Commands

```bash
# Check server status
pm2 status llm-router-http

# View server logs
pm2 logs llm-router-http --lines 50

# Check model files
ls -lah /home/mikecerqua/projects/LLM-Runner-Router/models/

# Test model loading
curl -X POST http://localhost:3006/api/models/load \
  -H "Content-Type: application/json" \
  -d '{"modelId": "tinyllama", "path": "models/tinyllama/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"}'
```

## Best Practices

1. **Start Small**: Test with TinyLlama (637MB) before larger models
2. **Monitor Resources**: Check RAM usage before loading large models
3. **One at a Time**: Unload models before loading new ones
4. **Regular Cleanup**: Delete unused models to free disk space
5. **Stable Connection**: Ensure stable internet for large downloads

## Security Notes

- Models download over HTTPS from HuggingFace
- No API keys required for public models
- Downloaded models stored locally
- No data sent to external services during inference

## Future Enhancements

- [ ] Resume interrupted downloads
- [ ] Model conversion tools (ONNX to GGUF)
- [ ] Custom model URL support
- [ ] Model performance benchmarking
- [ ] Multi-model ensemble support
- [ ] GPU acceleration options

---

*Last Updated: August 14, 2025*
*Version: 1.0.0*