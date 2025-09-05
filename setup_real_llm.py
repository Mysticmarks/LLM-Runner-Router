#!/usr/bin/env python3
"""
Setup a real LLM using HuggingFace Transformers
This will download and run a proper model
"""

import os
import sys
import json
from pathlib import Path

def main():
    print("🚀 Setting up REAL LLM inference...")
    
    # Check if transformers is installed
    try:
        import transformers
        print("✅ Transformers library found")
    except ImportError:
        print("📦 Installing transformers library...")
        os.system("pip3 install transformers torch --user")
        
    # Create a simple inference server
    inference_script = """
import json
import sys
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
import torch

print("Loading model...", file=sys.stderr)

# Use a small but real model that works
model_name = "microsoft/DialoGPT-small"

try:
    # Load tokenizer and model
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    
    # Create pipeline
    generator = pipeline('text-generation', model=model, tokenizer=tokenizer)
    
    print("Model loaded successfully!", file=sys.stderr)
    
    # Read input from stdin
    while True:
        try:
            line = input()
            data = json.loads(line)
            prompt = data.get('prompt', '')
            
            # Generate response
            result = generator(
                prompt,
                max_length=data.get('maxTokens', 100),
                temperature=data.get('temperature', 0.7),
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
            
            response_text = result[0]['generated_text']
            # Remove the input prompt from response
            if response_text.startswith(prompt):
                response_text = response_text[len(prompt):].strip()
            
            # Send response
            print(json.dumps({
                'response': response_text,
                'model': model_name
            }))
            sys.stdout.flush()
            
        except EOFError:
            break
        except Exception as e:
            print(json.dumps({'error': str(e)}))
            sys.stdout.flush()

except Exception as e:
    print(f"Failed to load model: {e}", file=sys.stderr)
    sys.exit(1)
"""
    
    # Write the inference server
    server_path = Path("/home/mikecerqua/projects/LLM-Runner-Router/python_inference_server.py")
    server_path.write_text(inference_script)
    server_path.chmod(0o755)
    
    print(f"✅ Created inference server at {server_path}")
    print("\n📝 To use this server:")
    print("1. Start it: python3 python_inference_server.py")
    print("2. Send JSON requests via stdin")
    print("3. Get responses on stdout")
    
    # Update the registry to use this
    print("\n🔧 Updating model registry...")
    registry = {
        "version": "1.0.0",
        "models": [
            {
                "id": "dialogpt-python",
                "name": "DialoGPT via Python",
                "format": "python",
                "source": "python3 /home/mikecerqua/projects/LLM-Runner-Router/python_inference_server.py",
                "loaded": False
            }
        ]
    }
    
    registry_path = Path("/home/mikecerqua/projects/LLM-Runner-Router/models/registry.json")
    registry_path.write_text(json.dumps(registry, indent=2))
    print("✅ Updated registry.json")

if __name__ == "__main__":
    main()