"""
Synchronous HTTP client for LLM Router (wrapper around async client)
"""

import asyncio
from typing import List, Dict, Any, Optional, Iterator
from functools import wraps

from .async_client import AsyncLLMRouterClient
from .models import (
    InferenceRequest,
    InferenceResponse,
    StreamingResponse,
    LoadModelRequest,
    LoadModelResponse,
    BatchInferenceRequest,
    BatchInferenceResponse,
    ModelInfo,
    RouterConfig,
    SystemMetrics,
)


def _async_to_sync(async_func):
    """Decorator to convert async functions to sync"""
    @wraps(async_func)
    def wrapper(self, *args, **kwargs):
        if self._loop is None:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
        
        return self._loop.run_until_complete(async_func(self, *args, **kwargs))
    
    return wrapper


def _async_to_sync_generator(async_generator_func):
    """Decorator to convert async generators to sync generators"""
    @wraps(async_generator_func)
    def wrapper(self, *args, **kwargs):
        if self._loop is None:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
        
        async_gen = async_generator_func(self, *args, **kwargs)
        
        try:
            while True:
                yield self._loop.run_until_complete(async_gen.__anext__())
        except StopAsyncIteration:
            pass
    
    return wrapper


class LLMRouterClient:
    """
    Synchronous HTTP client for LLM Router.
    
    This is a wrapper around AsyncLLMRouterClient that provides
    a synchronous interface for users who prefer blocking calls.
    """
    
    def __init__(self, config: Optional[RouterConfig] = None):
        self.config = config or RouterConfig()
        self._async_client = AsyncLLMRouterClient(self.config)
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._started = False
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    @_async_to_sync
    async def start(self):
        """Initialize the client"""
        if not self._started:
            await self._async_client.start()
            self._started = True
    
    @_async_to_sync
    async def close(self):
        """Close the client"""
        if self._started:
            await self._async_client.close()
            self._started = False
        
        if self._loop and self._loop.is_running():
            self._loop.close()
    
    @_async_to_sync
    async def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        return await self._async_client.health_check()
    
    @_async_to_sync
    async def get_status(self) -> Dict[str, Any]:
        """Get system status"""
        return await self._async_client.get_status()
    
    @_async_to_sync
    async def get_metrics(self) -> SystemMetrics:
        """Get system metrics"""
        return await self._async_client.get_metrics()
    
    @_async_to_sync
    async def list_models(self, include_unloaded: bool = False) -> List[ModelInfo]:
        """List available models"""
        return await self._async_client.list_models(include_unloaded=include_unloaded)
    
    @_async_to_sync
    async def get_model(self, model_id: str) -> ModelInfo:
        """Get information about a specific model"""
        return await self._async_client.get_model(model_id)
    
    @_async_to_sync
    async def load_model(self, request: LoadModelRequest) -> LoadModelResponse:
        """Load a model"""
        return await self._async_client.load_model(request)
    
    @_async_to_sync
    async def unload_model(self, model_id: str, force: bool = False) -> Dict[str, Any]:
        """Unload a model"""
        return await self._async_client.unload_model(model_id, force)
    
    @_async_to_sync
    async def inference(self, request: InferenceRequest) -> InferenceResponse:
        """Perform single inference"""
        return await self._async_client.inference(request)
    
    @_async_to_sync
    async def quick_inference(self, prompt: str, **options) -> InferenceResponse:
        """Quick inference with minimal setup"""
        return await self._async_client.quick_inference(prompt, **options)
    
    @_async_to_sync
    async def batch_inference(self, request: BatchInferenceRequest) -> BatchInferenceResponse:
        """Perform batch inference"""
        return await self._async_client.batch_inference(request)
    
    @_async_to_sync_generator
    async def stream_inference(self, request: InferenceRequest) -> Iterator[StreamingResponse]:
        """Stream inference tokens"""
        async for chunk in self._async_client.stream_inference(request):
            yield chunk
    
    @_async_to_sync
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model_id: Optional[str] = None,
        **options
    ) -> InferenceResponse:
        """Chat completion interface"""
        return await self._async_client.chat_completion(messages, model_id, **options)
    
    @_async_to_sync
    async def set_session_id(self, session_id: str):
        """Set session ID for request tracking"""
        await self._async_client.set_session_id(session_id)
    
    @_async_to_sync
    async def clear_session(self):
        """Clear session ID"""
        await self._async_client.clear_session()
    
    def __repr__(self) -> str:
        return f"LLMRouterClient(base_url='{self.config.base_url}')"


# Convenience functions for quick usage
def quick_inference(prompt: str, base_url: str = "http://localhost:3000", **options) -> InferenceResponse:
    """Quick inference without creating a client instance"""
    config = RouterConfig(base_url=base_url)
    with LLMRouterClient(config) as client:
        return client.quick_inference(prompt, **options)


def load_and_infer(source: str, prompt: str, base_url: str = "http://localhost:3000", **options) -> InferenceResponse:
    """Load a model and perform inference in one call"""
    config = RouterConfig(base_url=base_url)
    
    with LLMRouterClient(config) as client:
        # Load model
        load_request = LoadModelRequest(source=source)
        load_response = client.load_model(load_request)
        
        if not load_response.success:
            raise Exception(f"Failed to load model: {load_response.error}")
        
        # Perform inference
        model_id = load_response.model.id if load_response.model else None
        return client.quick_inference(prompt, model_id=model_id, **options)