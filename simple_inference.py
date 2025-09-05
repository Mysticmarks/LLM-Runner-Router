#!/usr/bin/env python3
"""
Real LLM inference script - NO PLACEHOLDERS, REAL INFERENCE ONLY
Falls back to error with debug info if model cannot load
"""
import json
import sys
import os
import traceback

# Try to import required libraries
try:
    from transformers import AutoTokenizer, AutoModelForCausalLM
    import torch
    LIBS_AVAILABLE = True
except ImportError as e:
    LIBS_AVAILABLE = False
    IMPORT_ERROR = str(e)

# Model path
MODEL_PATH = "/home/mikecerqua/projects/LLM-Runner-Router/models/smollm3-3b"

# Initialize model and tokenizer
model = None
tokenizer = None
model_error = None

if LIBS_AVAILABLE:
    print("Loading SmolLM3 model for REAL inference...", file=sys.stderr)
    sys.stderr.flush()
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
        
        # Optimize for CPU inference on VPS
        torch.set_num_threads(4)  # Use all 4 vCPUs
        torch.set_grad_enabled(False)  # Disable gradients for inference
        
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH,
            local_files_only=True,
            torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float16,  # Use float16 for speed
            device_map=None,  # Don't use auto for VPS
            low_cpu_mem_usage=True,
            use_cache=True  # Enable KV cache for faster generation
        )
        model.eval()
        print("Model loaded successfully - REAL INFERENCE READY", file=sys.stderr)
    except Exception as e:
        model_error = f"Model loading failed: {str(e)}\n{traceback.format_exc()}"
        print(model_error, file=sys.stderr)
else:
    model_error = f"Required libraries not available: {IMPORT_ERROR}"
    print(model_error, file=sys.stderr)

def generate_response(prompt, max_tokens=100, temperature=0.7):
    """Generate REAL response or return error with debug info - NO PLACEHOLDERS"""
    if model is None or tokenizer is None:
        # Return error with debug info - NO FAKE RESPONSES
        return {
            "error": "Model not loaded - cannot perform real inference",
            "debug": {
                "model_path": MODEL_PATH,
                "libs_available": LIBS_AVAILABLE,
                "model_error": model_error,
                "prompt_received": prompt[:100]
            }
        }
    
    try:
        # Format prompt for SmolLM3
        if not prompt.startswith("### "):
            formatted_prompt = f"### User: {prompt}\n\n### Assistant:"
        else:
            formatted_prompt = prompt
        
        # Real tokenization
        inputs = tokenizer(formatted_prompt, return_tensors="pt", truncation=True, max_length=512)
        
        # Real generation with optimizations
        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_new_tokens=min(max_tokens, 50),  # Limit tokens for speed
                temperature=temperature,
                do_sample=temperature > 0,  # Only sample if temp > 0
                top_p=0.9,
                top_k=40,  # Add top_k for faster sampling
                repetition_penalty=1.1,  # Prevent repetition
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id,
                use_cache=True,  # Use KV cache
                early_stopping=True  # Stop early if possible
            )
        
        # Real decoding
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract assistant response
        if "### Assistant:" in response:
            response = response.split("### Assistant:")[-1].strip()
        elif formatted_prompt in response:
            response = response.replace(formatted_prompt, "").strip()
        
        return {"response": response, "model": "smollm3-3b-real"}
    
    except Exception as e:
        # Return actual error - NO FAKE RESPONSES
        return {
            "error": f"Generation failed: {str(e)}",
            "debug": {
                "traceback": traceback.format_exc(),
                "prompt_length": len(prompt),
                "model_loaded": model is not None,
                "tokenizer_loaded": tokenizer is not None
            }
        }

print("Ready for inference", file=sys.stderr)
sys.stderr.flush()

while True:
    try:
        line = sys.stdin.readline()
        if not line:
            break
            
        data = json.loads(line)
        prompt = data.get('prompt', '')
        request_id = data.get('requestId')
        max_tokens = data.get('maxTokens', 100)
        temperature = data.get('temperature', 0.7)
        
        # Generate REAL response or error
        result = generate_response(prompt, max_tokens, temperature)
        
        # Send response
        if isinstance(result, dict) and "error" in result:
            # Send error response with debug info
            response = {
                'requestId': request_id,
                'error': result['error'],
                'debug': result.get('debug', {}),
                'model': 'error-no-inference'
            }
        else:
            # Send real LLM response
            response = {
                'requestId': request_id,
                'response': result.get('response', ''),
                'model': result.get('model', 'smollm3-3b')
            }
        
        print(json.dumps(response))
        sys.stdout.flush()
        
    except Exception as e:
        error_response = {
            'requestId': data.get('requestId') if 'data' in locals() else None,
            'error': f"Processing error: {str(e)}",
            'debug': {'traceback': traceback.format_exc()}
        }
        print(json.dumps(error_response))
        sys.stdout.flush()