"""
LLM Runner Router Python Client

A Python client library for the LLM Runner Router system, providing
async/await support, type hints, and comprehensive error handling.
"""

from .client import LLMRouterClient
from .async_client import AsyncLLMRouterClient
from .grpc_client import GRPCClient
from .websocket_client import WebSocketClient
from .models import (
    InferenceRequest,
    InferenceResponse,
    ModelInfo,
    LoadModelRequest,
    LoadModelResponse,
    StreamingResponse,
    ChatMessage,
    BatchInferenceRequest,
    BatchInferenceResponse,
    HealthStatus,
    SystemMetrics,
    ModelMetrics,
    InferenceOptions,
    RouterConfig,
)
from .exceptions import (
    LLMRouterError,
    ModelNotFoundError,
    InferenceError,
    NetworkError,
    TimeoutError,
    RateLimitError,
    ValidationError,
)

__version__ = "1.2.1"
__author__ = "Echo AI Systems"
__email__ = "contact@echoai.systems"
__url__ = "https://github.com/MCERQUA/LLM-Runner-Router"

__all__ = [
    # Main clients
    "LLMRouterClient",
    "AsyncLLMRouterClient", 
    "GRPCClient",
    "WebSocketClient",
    
    # Data models
    "InferenceRequest",
    "InferenceResponse",
    "ModelInfo",
    "LoadModelRequest",
    "LoadModelResponse",
    "StreamingResponse",
    "ChatMessage",
    "BatchInferenceRequest",
    "BatchInferenceResponse",
    "HealthStatus",
    "SystemMetrics",
    "ModelMetrics",
    "InferenceOptions",
    "RouterConfig",
    
    # Exceptions
    "LLMRouterError",
    "ModelNotFoundError",
    "InferenceError",
    "NetworkError",
    "TimeoutError",
    "RateLimitError",
    "ValidationError",
    
    # Package metadata
    "__version__",
    "__author__",
    "__email__",
    "__url__",
]