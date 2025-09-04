#!/usr/bin/env python3
"""
SmolLM3 Inference Server
Simple HTTP server for SmolLM3 model inference using transformers
"""

from flask import Flask, request, jsonify
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Model configuration
MODEL_PATH = "./models/smollm3-3b"
model = None
tokenizer = None

def load_model():
    """Load SmolLM3 model and tokenizer"""
    global model, tokenizer
    
    logger.info(f"Loading model from {MODEL_PATH}")
    
    # Load with CPU and reduced precision for VPS
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_PATH,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto",
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    
    logger.info("Model loaded successfully!")
    return model, tokenizer

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None
    })

@app.route('/generate', methods=['POST'])
def generate():
    """Generate text from prompt"""
    try:
        data = request.json
        prompt = data.get('prompt', '')
        max_tokens = data.get('max_tokens', 150)
        temperature = data.get('temperature', 0.7)
        
        if not prompt:
            return jsonify({"error": "No prompt provided"}), 400
        
        # Tokenize input
        inputs = tokenizer(prompt, return_tensors="pt")
        
        # Generate response
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
                top_p=0.95
            )
        
        # Decode response
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Remove the input prompt from response
        if response.startswith(prompt):
            response = response[len(prompt):].strip()
        
        return jsonify({
            "response": response,
            "prompt": prompt,
            "model": "SmolLM3-3B"
        })
        
    except Exception as e:
        logger.error(f"Generation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """Chat completion endpoint"""
    try:
        data = request.json
        messages = data.get('messages', [])
        
        if not messages:
            message = data.get('message', '')
            if message:
                messages = [{"role": "user", "content": message}]
            else:
                return jsonify({"error": "No messages provided"}), 400
        
        # Apply chat template
        prompt = tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        
        # Generate response
        inputs = tokenizer(prompt, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=150,
                temperature=0.7,
                do_sample=True,
                top_p=0.95
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract just the assistant's response
        if prompt in response:
            response = response[len(prompt):].strip()
        
        return jsonify({
            "response": response,
            "model": "SmolLM3-3B"
        })
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Load model on startup
    load_model()
    
    # Start server
    app.run(host='0.0.0.0', port=7860, debug=False)