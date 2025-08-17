"""
Exception classes for LLM Router client
"""

from typing import Optional, Any, Dict


class LLMRouterError(Exception):
    """Base exception for LLM Router client"""
    
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None,
        response_data: Optional[Dict[str, Any]] = None,
        original_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_data = response_data or {}
        self.original_error = original_error
    
    def __str__(self) -> str:
        parts = [self.message]
        if self.status_code:
            parts.append(f"Status: {self.status_code}")
        if self.response_data:
            parts.append(f"Data: {self.response_data}")
        return " | ".join(parts)


class NetworkError(LLMRouterError):
    """Network-related errors"""
    pass


class TimeoutError(LLMRouterError):
    """Request timeout errors"""
    pass


class RateLimitError(LLMRouterError):
    """Rate limiting errors"""
    pass


class AuthenticationError(LLMRouterError):
    """Authentication/authorization errors"""
    pass


class ValidationError(LLMRouterError):
    """Request validation errors"""
    pass


class ModelNotFoundError(LLMRouterError):
    """Model not found or not available"""
    pass


class InferenceError(LLMRouterError):
    """Inference processing errors"""
    pass


class ConfigurationError(LLMRouterError):
    """Configuration-related errors"""
    pass


class StreamingError(LLMRouterError):
    """Streaming response errors"""
    pass


class GRPCError(LLMRouterError):
    """gRPC-specific errors"""
    pass


class WebSocketError(LLMRouterError):
    """WebSocket-specific errors"""
    pass


# HTTP status code to exception mapping
STATUS_CODE_TO_EXCEPTION = {
    400: ValidationError,
    401: AuthenticationError,
    403: AuthenticationError,
    404: ModelNotFoundError,
    408: TimeoutError,
    429: RateLimitError,
    500: InferenceError,
    502: NetworkError,
    503: NetworkError,
    504: TimeoutError,
}


def create_exception_from_response(
    status_code: int,
    message: str,
    response_data: Optional[Dict[str, Any]] = None
) -> LLMRouterError:
    """Create appropriate exception based on status code"""
    exception_class = STATUS_CODE_TO_EXCEPTION.get(status_code, LLMRouterError)
    return exception_class(
        message=message,
        status_code=status_code,
        response_data=response_data
    )