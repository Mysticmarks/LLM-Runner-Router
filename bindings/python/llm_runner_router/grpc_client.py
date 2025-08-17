"""
gRPC client for LLM Router
"""

import asyncio
from typing import AsyncIterator, Dict, Any, Optional, List
import grpc
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from .models import (
    InferenceRequest,
    InferenceResponse,
    StreamingResponse,
    LoadModelRequest,
    LoadModelResponse,
    ModelInfo,
    RouterConfig,
    HealthStatus,
)
from .exceptions import GRPCError, TimeoutError, NetworkError

# Import generated protobuf classes (would be generated from .proto file)
# For now, we'll create mock classes that match the proto structure

logger = structlog.get_logger(__name__)


class MockProtoMessage:
    """Mock protobuf message for development"""
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class GRPCClient:
    """
    gRPC client for LLM Router with async support and error handling
    """
    
    def __init__(self, config: Optional[RouterConfig] = None):
        self.config = config or RouterConfig()
        self._channel: Optional[grpc.aio.Channel] = None
        self._stub = None
        
        # Parse gRPC URL
        if self.config.grpc_url:
            if "://" in self.config.grpc_url:
                self.grpc_host = self.config.grpc_url.split("://")[1]
            else:
                self.grpc_host = self.config.grpc_url
        else:
            self.grpc_host = "localhost:50051"
        
        logger.info("Initialized gRPC client", host=self.grpc_host)
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def connect(self):
        """Connect to gRPC server"""
        if self._channel is not None:
            return
        
        try:
            # Create secure or insecure channel based on configuration
            if self.grpc_host.startswith("localhost") or self.grpc_host.startswith("127.0.0.1"):
                self._channel = grpc.aio.insecure_channel(self.grpc_host)
            else:
                credentials = grpc.ssl_channel_credentials()
                self._channel = grpc.aio.secure_channel(self.grpc_host, credentials)
            
            # Wait for channel to be ready
            await grpc.aio.channel_ready_future(self._channel)
            
            # Create stub (would use generated stub class)
            # self._stub = LLMRouterServiceStub(self._channel)
            self._stub = MockGRPCStub(self._channel)
            
            logger.info("gRPC channel connected", host=self.grpc_host)
            
        except Exception as e:
            raise GRPCError(f"Failed to connect to gRPC server: {e}", original_error=e)
    
    async def close(self):
        """Close gRPC connection"""
        if self._channel:
            await self._channel.close()
            self._channel = None
            self._stub = None
            logger.info("gRPC channel closed")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True,
    )
    async def _call_with_retry(self, method_name: str, request):
        """Call gRPC method with retry logic"""
        if not self._stub:
            await self.connect()
        
        try:
            method = getattr(self._stub, method_name)
            return await method(request, timeout=self.config.timeout)
            
        except grpc.aio.AioRpcError as e:
            if e.code() == grpc.StatusCode.UNAVAILABLE:
                raise NetworkError(f"gRPC service unavailable: {e.details()}", original_error=e)
            elif e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
                raise TimeoutError(f"gRPC request timeout: {e.details()}", original_error=e)
            else:
                raise GRPCError(f"gRPC error: {e.details()}", original_error=e)
    
    async def health_check(self) -> Dict[str, Any]:
        """Check service health via gRPC"""
        logger.info("gRPC health check")
        
        request = MockProtoMessage(service="llm_router")
        response = await self._call_with_retry("HealthCheck", request)
        
        return {
            "status": response.status.name if hasattr(response.status, 'name') else str(response.status),
            "message": getattr(response, 'message', ''),
            "timestamp": getattr(response, 'timestamp', 0),
            "details": dict(getattr(response, 'details', {})),
        }
    
    async def list_models(self, include_unloaded: bool = False) -> List[ModelInfo]:
        """List models via gRPC"""
        logger.info("gRPC list models", include_unloaded=include_unloaded)
        
        request = MockProtoMessage(
            include_unloaded=include_unloaded,
            filter="",
            limit=100,
            offset=0
        )
        
        response = await self._call_with_retry("ListModels", request)
        
        models = []
        for model_proto in getattr(response, 'models', []):
            model_info = ModelInfo(
                id=getattr(model_proto, 'id', ''),
                name=getattr(model_proto, 'name', ''),
                format=getattr(model_proto, 'format', ''),
                source=getattr(model_proto, 'source', ''),
                loaded=getattr(model_proto, 'loaded', False),
                load_time=getattr(model_proto, 'load_time', None),
                memory_usage=getattr(model_proto, 'memory_usage', None),
                parameters=dict(getattr(model_proto, 'parameters', {})),
                version=getattr(model_proto, 'version', ''),
                capabilities=list(getattr(model_proto, 'capabilities', [])),
            )
            models.append(model_info)
        
        return models
    
    async def load_model(self, request: LoadModelRequest) -> LoadModelResponse:
        """Load model via gRPC"""
        logger.info("gRPC load model", source=request.source)
        
        grpc_request = MockProtoMessage(
            source=request.source,
            format=request.format or "",
            id=request.id or "",
            name=request.name or "",
            parameters=request.parameters,
            force_reload=request.force_reload,
        )
        
        response = await self._call_with_retry("LoadModel", grpc_request)
        
        model_info = None
        if hasattr(response, 'model') and response.model:
            model_info = ModelInfo(
                id=getattr(response.model, 'id', ''),
                name=getattr(response.model, 'name', ''),
                format=getattr(response.model, 'format', ''),
                source=getattr(response.model, 'source', ''),
                loaded=getattr(response.model, 'loaded', False),
                load_time=getattr(response.model, 'load_time', None),
                memory_usage=getattr(response.model, 'memory_usage', None),
                parameters=dict(getattr(response.model, 'parameters', {})),
                version=getattr(response.model, 'version', ''),
                capabilities=list(getattr(response.model, 'capabilities', [])),
            )
        
        return LoadModelResponse(
            success=getattr(response, 'success', False),
            message=getattr(response, 'message', ''),
            model=model_info,
            error=getattr(response, 'error', ''),
        )
    
    async def inference(self, request: InferenceRequest) -> InferenceResponse:
        """Perform inference via gRPC"""
        logger.info("gRPC inference", model_id=request.model_id)
        
        # Convert InferenceOptions to protobuf
        options_proto = MockProtoMessage(
            max_tokens=request.options.max_tokens if request.options else 500,
            temperature=request.options.temperature if request.options else 0.7,
            top_p=request.options.top_p if request.options else 1.0,
            top_k=request.options.top_k if request.options else None,
            frequency_penalty=request.options.frequency_penalty if request.options else 0.0,
            presence_penalty=request.options.presence_penalty if request.options else 0.0,
            stop_sequences=list(request.options.stop_sequences) if request.options and request.options.stop_sequences else [],
            stream=request.options.stream if request.options else False,
            seed=request.options.seed if request.options else None,
        )
        
        grpc_request = MockProtoMessage(
            prompt=request.prompt,
            model_id=request.model_id or "",
            options=options_proto,
            metadata=request.metadata,
            session_id=request.session_id or "",
        )
        
        response = await self._call_with_retry("Inference", grpc_request)
        
        return InferenceResponse(
            text=getattr(response, 'text', ''),
            model_id=getattr(response, 'model_id', ''),
            success=getattr(response, 'success', True),
            error=getattr(response, 'error', ''),
            metadata=dict(getattr(response, 'metadata', {})),
        )
    
    async def stream_inference(self, request: InferenceRequest) -> AsyncIterator[StreamingResponse]:
        """Stream inference via gRPC"""
        logger.info("gRPC stream inference", model_id=request.model_id)
        
        # Ensure streaming is enabled
        if not request.options:
            request.options = InferenceOptions()
        request.options.stream = True
        
        # Convert to gRPC request (similar to inference method)
        options_proto = MockProtoMessage(
            max_tokens=request.options.max_tokens,
            temperature=request.options.temperature,
            top_p=request.options.top_p,
            top_k=request.options.top_k,
            frequency_penalty=request.options.frequency_penalty,
            presence_penalty=request.options.presence_penalty,
            stop_sequences=list(request.options.stop_sequences or []),
            stream=True,
            seed=request.options.seed,
        )
        
        grpc_request = MockProtoMessage(
            prompt=request.prompt,
            model_id=request.model_id or "",
            options=options_proto,
            metadata=request.metadata,
            session_id=request.session_id or "",
        )
        
        try:
            if not self._stub:
                await self.connect()
            
            stream = self._stub.StreamInference(grpc_request, timeout=self.config.timeout)
            
            async for response in stream:
                yield StreamingResponse(
                    token=getattr(response, 'token', ''),
                    is_complete=getattr(response, 'is_complete', False),
                    model_id=getattr(response, 'model_id', ''),
                    error=getattr(response, 'error', ''),
                )
                
                if getattr(response, 'is_complete', False):
                    break
                    
        except grpc.aio.AioRpcError as e:
            if e.code() == grpc.StatusCode.UNAVAILABLE:
                raise NetworkError(f"gRPC streaming unavailable: {e.details()}", original_error=e)
            elif e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
                raise TimeoutError(f"gRPC streaming timeout: {e.details()}", original_error=e)
            else:
                raise GRPCError(f"gRPC streaming error: {e.details()}", original_error=e)
    
    def __repr__(self) -> str:
        return f"GRPCClient(host='{self.grpc_host}')"


class MockGRPCStub:
    """Mock gRPC stub for development (replace with generated stub)"""
    
    def __init__(self, channel):
        self.channel = channel
    
    async def HealthCheck(self, request, timeout=None):
        """Mock health check"""
        return MockProtoMessage(
            status=MockProtoMessage(name="HEALTHY"),
            message="Service is healthy",
            timestamp=1234567890,
            details={}
        )
    
    async def ListModels(self, request, timeout=None):
        """Mock list models"""
        return MockProtoMessage(
            models=[
                MockProtoMessage(
                    id="mock-model",
                    name="Mock Model",
                    format="mock",
                    source="mock://model",
                    loaded=True,
                    capabilities=["text-generation"]
                )
            ],
            total_count=1,
            has_more=False
        )
    
    async def LoadModel(self, request, timeout=None):
        """Mock load model"""
        return MockProtoMessage(
            success=True,
            message="Model loaded successfully",
            model=MockProtoMessage(
                id="mock-model",
                name="Mock Model",
                format="mock",
                source=request.source,
                loaded=True
            )
        )
    
    async def Inference(self, request, timeout=None):
        """Mock inference"""
        return MockProtoMessage(
            text=f"Mock response to: {request.prompt}",
            model_id=request.model_id,
            success=True,
            metadata={}
        )
    
    async def StreamInference(self, request, timeout=None):
        """Mock streaming inference"""
        tokens = ["Mock", " streaming", " response", " to:", " ", request.prompt]
        
        for i, token in enumerate(tokens):
            yield MockProtoMessage(
                token=token,
                is_complete=(i == len(tokens) - 1),
                model_id=request.model_id
            )