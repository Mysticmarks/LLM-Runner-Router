#!/usr/bin/env python3

"""
Basic Python example demonstrating LLM Router usage

This example shows:
- Async client initialization
- Basic inference requests
- Error handling with context managers
- Performance monitoring
- Proper resource cleanup
"""

import asyncio
import time
import sys
import traceback
from typing import Optional

# Add the bindings to the path for development
sys.path.insert(0, '../../../bindings/python')

from llm_runner_router import (
    AsyncLLMRouterClient,
    LLMRouterClient,
    RouterConfig,
    InferenceRequest,
    InferenceOptions,
    LLMRouterError,
    NetworkError,
    TimeoutError,
    ModelNotFoundError
)


async def async_basic_inference():
    """Demonstrate async client usage"""
    print("🚀 LLM Router Python Async Example\n")
    
    # Configure the client
    config = RouterConfig(
        base_url="http://localhost:3000",
        timeout=30.0,
        max_retries=3,
        api_key=None  # Set if authentication is required
    )
    
    start_time = time.time()
    
    async with AsyncLLMRouterClient(config) as client:
        try:
            print("📚 Client initialized...")
            init_time = time.time() - start_time
            print(f"✅ Initialization completed in {init_time:.2f}s\n")
            
            # Check server health
            print("🏥 Checking server health...")
            health = await client.health_check()
            print(f"   Status: {health.get('status', 'unknown')}")
            print(f"   Models: {health.get('modelsLoaded', 0)}")
            print(f"   Engine: {health.get('engine', 'unknown')}\n")
            
            # Basic inference
            print("🤖 Running basic inference...")
            inference_start = time.time()
            
            response = await client.quick_inference(
                prompt="What is machine learning and how does it work?",
                max_tokens=150,
                temperature=0.7
            )
            
            inference_time = time.time() - inference_start
            
            print("\n📝 Response:")
            print(f"   Text: {response.text}")
            print(f"   Model: {response.model or 'unknown'}")
            print(f"   Time: {inference_time:.2f}s")
            print(f"   Success: {response.success}\n")
            
            # Advanced inference with custom options
            print("🎛️ Running advanced inference...")
            advanced_start = time.time()
            
            request = InferenceRequest(
                prompt="Explain the benefits of Python over other programming languages",
                options=InferenceOptions(
                    max_tokens=200,
                    temperature=0.6,
                    top_p=0.9,
                    top_k=40,
                    stream=False
                ),
                model_id=None  # Let router choose
            )
            
            advanced_response = await client.inference(request)
            advanced_time = time.time() - advanced_start
            
            print("\n📝 Advanced Response:")
            print(f"   Text: {advanced_response.text}")
            print(f"   Model: {advanced_response.model or 'unknown'}")
            print(f"   Time: {advanced_time:.2f}s")
            print(f"   Tokens: {advanced_response.usage.get('total_tokens', 0) if advanced_response.usage else 0}\n")
            
            # List available models
            print("📋 Available models:")
            try:
                models = await client.list_models()
                for i, model in enumerate(models, 1):
                    status = "✅ loaded" if getattr(model, 'loaded', False) else "⏳ available"
                    print(f"   {i}. {model.name or model.id} ({model.format or 'unknown'}) - {status}")
            except Exception as e:
                print(f"   ⚠️  Could not list models: {e}")
            
            print()
            
            # Demonstrate error handling
            print("🔧 Testing error handling...")
            try:
                await client.quick_inference(
                    prompt="Test prompt",
                    model_id="nonexistent-model"
                )
            except ModelNotFoundError as e:
                print(f"   ✅ Correctly caught ModelNotFoundError: {e}")
            except Exception as e:
                print(f"   ⚠️  Unexpected error: {e}")
            
        except NetworkError as e:
            print(f"❌ Network error: {e}")
            print("💡 Tip: Make sure the LLM Router server is running on http://localhost:3000")
        except TimeoutError as e:
            print(f"❌ Timeout error: {e}")
            print("💡 Tip: Increase the timeout or check server performance")
        except LLMRouterError as e:
            print(f"❌ LLM Router error: {e}")
            print(f"   Type: {type(e).__name__}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            print(f"   Type: {type(e).__name__}")
            traceback.print_exc()


def sync_basic_inference():
    """Demonstrate synchronous client usage"""
    print("🔄 LLM Router Python Sync Example\n")
    
    start_time = time.time()
    
    with LLMRouterClient() as client:
        try:
            print("📚 Sync client initialized...")
            init_time = time.time() - start_time
            print(f"✅ Initialization completed in {init_time:.2f}s\n")
            
            # Simple inference
            print("🤖 Running sync inference...")
            inference_start = time.time()
            
            response = client.quick_inference("What is Python programming?")
            
            inference_time = time.time() - inference_start
            
            print("\n📝 Sync Response:")
            print(f"   Text: {response.text}")
            print(f"   Model: {response.model or 'unknown'}")
            print(f"   Time: {inference_time:.2f}s\n")
            
        except Exception as e:
            print(f"❌ Sync client error: {e}")


def monitor_performance():
    """Monitor memory and performance metrics"""
    try:
        import psutil
        process = psutil.Process()
        
        print("📊 Performance Metrics:")
        print(f"   Memory RSS: {process.memory_info().rss / 1024 / 1024:.2f} MB")
        print(f"   Memory VMS: {process.memory_info().vms / 1024 / 1024:.2f} MB")
        print(f"   CPU Percent: {process.cpu_percent():.2f}%")
        print(f"   Threads: {process.num_threads()}")
    except ImportError:
        print("📊 Performance Metrics: (install psutil for detailed metrics)")
        import resource
        memory_usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # On Linux, this is in KB; on macOS, it's in bytes
        memory_mb = memory_usage / 1024 if sys.platform == 'darwin' else memory_usage / 1024
        print(f"   Max Memory: {memory_mb:.2f} MB")


async def streaming_example():
    """Demonstrate streaming inference"""
    print("🌊 Streaming Inference Example\n")
    
    config = RouterConfig(base_url="http://localhost:3000")
    
    async with AsyncLLMRouterClient(config) as client:
        try:
            request = InferenceRequest(
                prompt="Tell me a short story about artificial intelligence",
                options=InferenceOptions(
                    max_tokens=100,
                    temperature=0.8,
                    stream=True
                )
            )
            
            print("🤖 Starting streaming inference...")
            print("📝 Response: ", end="", flush=True)
            
            async for chunk in client.stream_inference(request):
                if chunk.token:
                    print(chunk.token, end="", flush=True)
                if chunk.is_complete:
                    print("\n✅ Streaming complete!")
                    break
                    
        except Exception as e:
            print(f"\n❌ Streaming error: {e}")


async def main():
    """Main example function"""
    print("=" * 60)
    print("🐍 LLM Router Python Examples")
    print("=" * 60)
    print()
    
    try:
        # Run async example
        await async_basic_inference()
        
        print("\n" + "-" * 40 + "\n")
        
        # Run sync example
        sync_basic_inference()
        
        print("\n" + "-" * 40 + "\n")
        
        # Run streaming example
        await streaming_example()
        
        print("\n" + "-" * 40 + "\n")
        
        # Show performance metrics
        monitor_performance()
        
        print("\n🎉 All examples completed successfully!")
        
    except KeyboardInterrupt:
        print("\n👋 Examples interrupted by user")
    except Exception as e:
        print(f"\n💥 Examples failed: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Handle asyncio on different Python versions
    try:
        asyncio.run(main())
    except AttributeError:
        # Python < 3.7
        loop = asyncio.get_event_loop()
        loop.run_until_complete(main())
        loop.close()