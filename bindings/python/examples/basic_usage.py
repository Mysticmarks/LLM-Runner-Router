#!/usr/bin/env python3
"""
Basic usage examples for LLM Router Python client
"""

import asyncio
from llm_runner_router import (
    AsyncLLMRouterClient,
    LLMRouterClient,
    InferenceRequest,
    LoadModelRequest,
    InferenceOptions,
    RouterConfig,
)


async def async_example():
    """Example using async client"""
    print("=== Async Client Example ===")
    
    # Create client with custom configuration
    config = RouterConfig(
        base_url="http://localhost:3000",
        timeout=30.0,
    )
    
    async with AsyncLLMRouterClient(config) as client:
        # Health check
        print("1. Health check...")
        health = await client.health_check()
        print(f"Health: {health}")
        
        # List models
        print("\n2. Listing models...")
        models = await client.list_models()
        print(f"Available models: {len(models)}")
        for model in models:
            print(f"  - {model.id}: {model.name} ({model.format})")
        
        # Quick inference (if models are available)
        if models:
            print("\n3. Quick inference...")
            response = await client.quick_inference(
                "What is the capital of France?",
                max_tokens=100,
                temperature=0.7
            )
            print(f"Response: {response.text}")
        
        # Streaming inference
        print("\n4. Streaming inference...")
        request = InferenceRequest(
            prompt="Tell me a short story about a robot.",
            options=InferenceOptions(
                max_tokens=200,
                temperature=0.8,
                stream=True
            )
        )
        
        print("Stream: ", end="")
        async for chunk in client.stream_inference(request):
            if chunk.token:
                print(chunk.token, end="", flush=True)
            if chunk.is_complete:
                print("\n")
                break


def sync_example():
    """Example using synchronous client"""
    print("=== Sync Client Example ===")
    
    config = RouterConfig(base_url="http://localhost:3000")
    
    with LLMRouterClient(config) as client:
        # Health check
        print("1. Health check...")
        health = client.health_check()
        print(f"Health: {health}")
        
        # List models
        print("\n2. Listing models...")
        models = client.list_models()
        print(f"Available models: {len(models)}")
        
        # Quick inference
        if models:
            print("\n3. Quick inference...")
            response = client.quick_inference(
                "What is 2 + 2?",
                max_tokens=50
            )
            print(f"Response: {response.text}")


async def load_model_example():
    """Example of loading a custom model"""
    print("=== Load Model Example ===")
    
    async with AsyncLLMRouterClient() as client:
        # Load a model
        print("Loading model...")
        load_request = LoadModelRequest(
            source="./models/example-model.gguf",
            format="gguf",
            id="example-model",
            name="Example GGUF Model"
        )
        
        try:
            result = await client.load_model(load_request)
            if result.success:
                print(f"Model loaded: {result.model.id}")
                
                # Use the loaded model
                response = await client.quick_inference(
                    "Hello, how are you?",
                    model_id="example-model"
                )
                print(f"Response: {response.text}")
            else:
                print(f"Failed to load model: {result.error}")
                
        except Exception as e:
            print(f"Error loading model: {e}")


async def batch_inference_example():
    """Example of batch inference"""
    print("=== Batch Inference Example ===")
    
    from llm_runner_router import BatchInferenceRequest
    
    async with AsyncLLMRouterClient() as client:
        # Create multiple inference requests
        requests = [
            InferenceRequest(prompt="What is the capital of France?"),
            InferenceRequest(prompt="What is the capital of Germany?"),
            InferenceRequest(prompt="What is the capital of Spain?"),
        ]
        
        batch_request = BatchInferenceRequest(
            requests=requests,
            max_concurrent=2,
            timeout_ms=30000
        )
        
        try:
            result = await client.batch_inference(batch_request)
            print(f"Batch completed: {result.successful_requests}/{result.total_requests}")
            
            for i, response in enumerate(result.responses):
                if response.success:
                    print(f"Response {i+1}: {response.text}")
                else:
                    print(f"Response {i+1} failed: {response.error}")
                    
        except Exception as e:
            print(f"Batch inference failed: {e}")


async def chat_example():
    """Example of chat completion"""
    print("=== Chat Example ===")
    
    async with AsyncLLMRouterClient() as client:
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is machine learning?"},
        ]
        
        try:
            response = await client.chat_completion(
                messages=messages,
                max_tokens=200,
                temperature=0.7
            )
            print(f"Assistant: {response.text}")
            
        except Exception as e:
            print(f"Chat failed: {e}")


async def websocket_example():
    """Example using WebSocket client"""
    print("=== WebSocket Example ===")
    
    from llm_runner_router import WebSocketClient
    
    config = RouterConfig(websocket_url="ws://localhost:3000/ws")
    
    try:
        async with WebSocketClient(config) as ws_client:
            # Health check via WebSocket
            health = await ws_client.health_check()
            print(f"WebSocket Health: {health}")
            
            # Inference via WebSocket
            request = InferenceRequest(
                prompt="What is the meaning of life?",
                options=InferenceOptions(max_tokens=100)
            )
            
            response = await ws_client.inference(request)
            print(f"WebSocket Response: {response.text}")
            
    except Exception as e:
        print(f"WebSocket example failed: {e}")


async def error_handling_example():
    """Example of error handling"""
    print("=== Error Handling Example ===")
    
    from llm_runner_router import ModelNotFoundError, NetworkError, TimeoutError
    
    config = RouterConfig(
        base_url="http://localhost:3000",
        timeout=5.0  # Short timeout for demo
    )
    
    async with AsyncLLMRouterClient(config) as client:
        try:
            # Try to use a non-existent model
            response = await client.quick_inference(
                "Hello",
                model_id="non-existent-model"
            )
            print(f"Response: {response.text}")
            
        except ModelNotFoundError as e:
            print(f"Model not found: {e}")
        except NetworkError as e:
            print(f"Network error: {e}")
        except TimeoutError as e:
            print(f"Timeout: {e}")
        except Exception as e:
            print(f"Other error: {e}")


def main():
    """Run all examples"""
    print("LLM Router Python Client Examples\n")
    
    # Run async examples
    asyncio.run(async_example())
    print()
    
    # Run sync example
    sync_example()
    print()
    
    # Run other examples
    asyncio.run(load_model_example())
    print()
    
    asyncio.run(batch_inference_example())
    print()
    
    asyncio.run(chat_example())
    print()
    
    asyncio.run(websocket_example())
    print()
    
    asyncio.run(error_handling_example())


if __name__ == "__main__":
    main()