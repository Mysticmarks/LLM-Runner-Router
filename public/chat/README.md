# 💬 Interactive Chat Demo

A fully functional chat interface demonstrating the capabilities of the LLM Runner Router system.

## Features

### 🎯 **Intelligent Routing Simulation**
- **Balanced**: Optimal mix of quality, speed, and cost
- **Quality First**: Prioritizes highest quality responses  
- **Cost Optimized**: Budget-friendly model selection
- **Speed Priority**: Fastest response times
- **Random**: Unpredictable model selection
- **Round Robin**: Fair distribution across models

### ⚙️ **Configurable Parameters**
- **Temperature**: Creativity level (0.0 - 1.0)
- **Max Tokens**: Response length control (50-500)
- **Streaming**: Real-time response generation
- **Model Status**: Live monitoring of available models

### 📊 **Real-Time Analytics**
- Message count tracking
- Average response time monitoring
- Total token consumption
- Performance metrics dashboard

### 🎨 **Interactive Features**
- Typing indicators during processing
- Message timestamps and routing metadata  
- Contextual responses based on input patterns
- Responsive design for all devices
- Keyboard shortcuts (Ctrl+Enter to send)

## Usage Examples

### Quick Demos
- **"Hello"** - Greeting recognition
- **"Explain quantum computing"** - Technical explanations
- **"Write a haiku about AI"** - Creative content generation
- **"How does the router work?"** - System information

### Routing Strategy Testing
1. Change routing strategy in the sidebar
2. Ask the same question multiple times
3. Observe different model selections and response patterns
4. Monitor performance metrics changes

## Technical Implementation

### Frontend Architecture
- **Pure JavaScript**: No external dependencies
- **Modern CSS**: Glassmorphism design with animations
- **Responsive Layout**: Mobile-first approach
- **Real-time Updates**: Dynamic UI state management

### Simulation Engine
- **Contextual Responses**: Pattern-based intelligent replies
- **Realistic Delays**: Strategy-based response timing
- **Token Estimation**: Accurate usage calculations
- **Model Selection**: Algorithm-driven routing decisions

### Performance Features
- **Smooth Animations**: 60fps interface transitions
- **Efficient Rendering**: Minimal DOM manipulation
- **Memory Management**: Automatic cleanup of old messages
- **Error Handling**: Graceful degradation on failures

## Deployment

This chat demo is automatically included in the build process and deploys alongside the main documentation site. Access it at:

- **Local Development**: `http://localhost:3000/chat/`
- **Netlify Production**: `https://your-site.netlify.app/chat/`

## Customization

The demo can be customized by modifying:

- **`chat.js`**: Response patterns, routing logic, timing
- **`styles.css`**: Visual design, animations, layout
- **`index.html`**: UI components, controls, structure

## Browser Support

- **Chrome/Edge**: Full feature support
- **Firefox**: Full feature support  
- **Safari**: Full feature support
- **Mobile Browsers**: Responsive design optimized

## Future Enhancements

- [ ] WebSocket integration for real-time model communication
- [ ] Advanced routing algorithms with machine learning
- [ ] Multi-language support and localization
- [ ] Voice input/output capabilities
- [ ] Integration with actual LLM APIs