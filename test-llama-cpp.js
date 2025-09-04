#!/usr/bin/env node
/**
 * Test node-llama-cpp with actual model inference
 * NO PYTHON REQUIRED - Pure Node.js
 */

import { getLlama, LlamaChatSession } from "node-llama-cpp";

async function testLlamaCpp() {
  console.log("🚀 Testing node-llama-cpp...");
  
  try {
    const llama = await getLlama();
    console.log("✅ Llama loaded");
    
    // Try to load a GGUF model if available
    const modelPath = "./models/Meta-Llama-3-8B.Q2_K.gguf";
    
    console.log(`📦 Loading model: ${modelPath}`);
    const model = await llama.loadModel({
      modelPath: modelPath
    });
    console.log("✅ Model loaded successfully!");
    
    // Create context
    const context = await model.createContext();
    console.log("✅ Context created");
    
    // Create chat session
    const session = new LlamaChatSession({
      contextSequence: context.getSequence()
    });
    console.log("✅ Chat session created");
    
    // Test inference
    const prompt = "What is 2+2?";
    console.log(`\n💬 Prompt: ${prompt}`);
    
    const response = await session.prompt(prompt);
    console.log(`🤖 Response: ${response}`);
    
    console.log("\n✅ SUCCESS! Node-llama-cpp is working with actual AI inference!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.log("\nTrying to download a model first...");
    
    // If no model, provide instructions
    console.log(`
To get a working GGUF model, run:
wget https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_K_M.gguf -P models/
    `);
  }
  
  process.exit(0);
}

testLlamaCpp();