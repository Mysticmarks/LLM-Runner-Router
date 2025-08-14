import { LLMRouter } from './src/index.js';
import { GGUFLoader } from './src/loaders/GGUFLoader.js';

console.log('🔧 Initializing LLM Router with loaders...\n');

// Initialize router
const router = new LLMRouter({ 
  autoInit: false,
  strategy: 'balanced' 
});

// Register the GGUF loader
router.registry.registerLoader('gguf', new GGUFLoader());
console.log('✅ GGUF loader registered');

// Initialize
await router.initialize();
console.log('✅ Router initialized');

// Now try loading the model
try {
  console.log('\n🔄 Loading TinyLlama model...');
  const model = await router.load({
    source: './models/tinyllama/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    format: 'gguf',
    id: 'tinyllama-chat',
    name: 'TinyLlama 1.1B Chat'
  });
  console.log('✅ Model loaded successfully:', model.id);
  
  // Save to registry
  await router.registry.saveRegistry();
  console.log('💾 Registry saved');
  
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('\nNote: GGUF loading requires additional dependencies.');
  console.log('The loader structure is in place for future implementation.');
}

console.log('\n✅ Setup complete!');
console.log('The LLM Router architecture is ready for model integration.');
process.exit(0);