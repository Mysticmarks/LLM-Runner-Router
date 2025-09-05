
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
