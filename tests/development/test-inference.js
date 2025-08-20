import { LLMRouter } from './src/index.js';

async function testInference() {
  console.log('Testing mock inference...');
  
  const router = new LLMRouter({
    strategy: 'balanced',
    autoInit: false
  });
  
  // Load a mock model
  const model = await router.load({
    source: 'mock://test-model',
    type: 'mock'
  });
  
  console.log('Model loaded:', model.id);
  
  // Test inference
  const result = await router.inference('Hello, world!', {
    modelId: model.id
  });
  
  console.log('Inference result:', result);
  
  // Test streaming
  console.log('Testing streaming...');
  const stream = router.stream('Tell me a story', {
    modelId: model.id
  });
  
  let tokens = [];
  for await (const token of stream) {
    tokens.push(token);
  }
  
  console.log('Stream tokens:', tokens.length);
  console.log('✅ All tests passed!');
}

testInference().catch(console.error);