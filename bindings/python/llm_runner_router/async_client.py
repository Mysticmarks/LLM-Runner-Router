"""
Async HTTP client for LLM Router
"""

import asyncio
import json
from typing import AsyncIterator, Dict, Any, Optional, List, Union
from contextlib import asynccontextmanager

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential
from asyncio_throttle import Throttler

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
    HealthStatus,
)
from .exceptions import (
    create_exception_from_response,
    NetworkError,
    TimeoutError,
    StreamingError,
    ValidationError,
)

logger = structlog.get_logger(__name__)


class AsyncLLMRouterClient:
    """
    Async HTTP client for LLM Router with comprehensive error handling,
    retries, rate limiting, and streaming support.
    """
    
    def __init__(self, config: Optional[RouterConfig] = None):
        self.config = config or RouterConfig()
        self._client: Optional[httpx.AsyncClient] = None
        self._throttler = Throttler(rate_limit=100, period=60)  # 100 requests per minute
        self._session_id: Optional[str] = None
        
        logger.info("Initialized AsyncLLMRouterClient", base_url=self.config.base_url)
    
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    @asynccontextmanager
    async def _get_client(self):
        """Get or create HTTP client"""
        if self._client is None:
            await self.start()
        yield self._client
    
    async def start(self):
        """Initialize the HTTP client"""
        if self._client is not None:
            return
        
        headers = {
            "User-Agent": self.config.user_agent,
            "Content-Type": "application/json",
        }
        
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        self._client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=httpx.Timeout(self.config.timeout),
            headers=headers,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        )
        
        logger.info("HTTP client started", base_url=self.config.base_url)
    
    async def close(self):
        """Close the HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("HTTP client closed")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True,
    )
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make HTTP request with retries and error handling"""
        async with self._throttler:
            async with self._get_client() as client:
                try:
                    url = f"/api/v1/{endpoint.lstrip('/')}"
                    
                    if method.upper() == "GET":
                        response = await client.get(url, params=params)
                    elif method.upper() == "POST":
                        response = await client.post(url, json=data, params=params)
                    elif method.upper() == "PUT":
                        response = await client.put(url, json=data, params=params)
                    elif method.upper() == "DELETE":
                        response = await client.delete(url, params=params)
                    else:
                        raise ValueError(f"Unsupported HTTP method: {method}")
                    
                    # Handle non-2xx status codes
                    if response.status_code >= 400:
                        try:
                            error_data = response.json()
                            message = error_data.get("error", "Request failed")
                        except:
                            message = f"HTTP {response.status_code}: {response.text}"
                        
                        raise create_exception_from_response(
                            status_code=response.status_code,
                            message=message,
                            response_data=error_data if 'error_data' in locals() else None,
                        )
                    
                    return response.json()
                    
                except httpx.TimeoutException as e:
                    raise TimeoutError(f"Request timeout: {e}", original_error=e)
                except httpx.NetworkError as e:
                    raise NetworkError(f"Network error: {e}", original_error=e)
                except json.JSONDecodeError as e:
                    raise ValidationError(f"Invalid JSON response: {e}", original_error=e)
    
    async def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        logger.info("Checking health")
        return await self._make_request("GET", "health")
    
    async def get_status(self) -> Dict[str, Any]:
        """Get system status"""
        logger.info("Getting system status")
        return await self._make_request("GET", "status")
    
    async def get_metrics(self) -> SystemMetrics:
        """Get system metrics"""
        logger.info("Getting system metrics")
        data = await self._make_request("GET", "metrics")
        return SystemMetrics(**data)
    
    async def list_models(self, include_unloaded: bool = False) -> List[ModelInfo]:
        """List available models"""
        logger.info("Listing models", include_unloaded=include_unloaded)
        params = {"include_unloaded": include_unloaded}
        data = await self._make_request("GET", "models", params=params)
        return [ModelInfo(**model) for model in data.get("models", [])]
    
    async def get_model(self, model_id: str) -> ModelInfo:
        """Get information about a specific model"""
        logger.info("Getting model info", model_id=model_id)
        data = await self._make_request("GET", f"models/{model_id}")
        return ModelInfo(**data)
    
    async def load_model(self, request: LoadModelRequest) -> LoadModelResponse:
        """Load a model"""
        logger.info("Loading model", source=request.source, format=request.format)
        data = await self._make_request("POST", "models/load", data=request.model_dump())
        return LoadModelResponse(**data)
    
    async def unload_model(self, model_id: str, force: bool = False) -> Dict[str, Any]:
        """Unload a model"""
        logger.info("Unloading model", model_id=model_id, force=force)
        data = {"model_id": model_id, "force": force}
        return await self._make_request("POST", "models/unload", data=data)
    
    async def inference(self, request: InferenceRequest) -> InferenceResponse:
        """Perform single inference"""
        logger.info("Running inference", model_id=request.model_id, prompt_length=len(request.prompt))
        
        data = request.model_dump()
        if self._session_id:
            data["session_id"] = self._session_id
        
        response_data = await self._make_request("POST", "inference", data=data)
        return InferenceResponse(**response_data)
    
    async def quick_inference(self, prompt: str, **options) -> InferenceResponse:
        """Quick inference with minimal setup"""
        request = InferenceRequest(prompt=prompt, **options)
        return await self.inference(request)
    
    async def batch_inference(self, request: BatchInferenceRequest) -> BatchInferenceResponse:
        """Perform batch inference"""
        logger.info("Running batch inference", num_requests=len(request.requests))
        data = await self._make_request("POST", "inference/batch", data=request.model_dump())
        return BatchInferenceResponse(**data)
    
    async def stream_inference(
        self, 
        request: InferenceRequest
    ) -> AsyncIterator[StreamingResponse]:
        """Stream inference tokens"""
        logger.info("Starting streaming inference", model_id=request.model_id)
        
        data = request.model_dump()
        data["options"] = data.get("options", {})
        data["options"]["stream"] = True
        
        if self._session_id:
            data["session_id"] = self._session_id
        
        async with self._throttler:
            async with self._get_client() as client:
                try:
                    url = f"{self.config.base_url}/api/v1/inference/stream"
                    
                    async with client.stream("POST", url, json=data) as response:
                        if response.status_code >= 400:
                            error_text = await response.aread()
                            raise create_exception_from_response(
                                status_code=response.status_code,
                                message=f"Streaming failed: {error_text.decode()}",
                            )
                        
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                try:
                                    chunk_data = json.loads(line[6:])  # Remove "data: " prefix
                                    yield StreamingResponse(**chunk_data)
                                    
                                    # Check if stream is complete
                                    if chunk_data.get("is_complete", False):
                                        break
                                        
                                except json.JSONDecodeError as e:
                                    logger.warning("Failed to parse streaming chunk", line=line, error=str(e))
                                    continue
                                except Exception as e:
                                    raise StreamingError(f"Error processing stream chunk: {e}", original_error=e)
                
                except httpx.TimeoutException as e:
                    raise TimeoutError(f"Streaming timeout: {e}", original_error=e)
                except httpx.NetworkError as e:
                    raise NetworkError(f"Streaming network error: {e}", original_error=e)
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model_id: Optional[str] = None,
        **options
    ) -> InferenceResponse:
        """Chat completion interface"""
        # Convert messages to a single prompt (simplified)
        prompt = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in messages])
        
        request = InferenceRequest(
            prompt=prompt,
            model_id=model_id,
            options=options,
        )
        
        return await self.inference(request)
    
    async def set_session_id(self, session_id: str):
        """Set session ID for request tracking"""
        self._session_id = session_id
        logger.info("Session ID set", session_id=session_id)
    
    async def clear_session(self):
        """Clear session ID"""
        self._session_id = None
        logger.info("Session cleared")
    
    def __repr__(self) -> str:
        return f"AsyncLLMRouterClient(base_url='{self.config.base_url}')"