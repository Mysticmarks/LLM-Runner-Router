"""
Data models for LLM Router client
"""

from typing import Any, Dict, List, Optional, Union, Literal
from pydantic import BaseModel, Field, ConfigDict, validator
from enum import Enum
import asyncio
from datetime import datetime


class HealthStatus(str, Enum):
    """Health status enumeration"""
    UNKNOWN = "UNKNOWN"
    HEALTHY = "HEALTHY"
    UNHEALTHY = "UNHEALTHY"
    DEGRADED = "DEGRADED"
    MAINTENANCE = "MAINTENANCE"


class InferenceOptions(BaseModel):
    """Options for inference requests"""
    model_config = ConfigDict(extra="allow")
    
    max_tokens: Optional[int] = Field(default=500, ge=1, le=8192)
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    top_k: Optional[int] = Field(default=None, ge=1)
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    stop_sequences: Optional[List[str]] = Field(default_factory=list)
    stream: Optional[bool] = Field(default=False)
    seed: Optional[int] = Field(default=None)


class InferenceMetrics(BaseModel):
    """Metrics from inference"""
    model_config = ConfigDict(extra="allow")
    
    latency_ms: Optional[int] = Field(default=None, ge=0)
    tokens_generated: Optional[int] = Field(default=None, ge=0)
    tokens_per_second: Optional[float] = Field(default=None, ge=0.0)
    memory_used: Optional[int] = Field(default=None, ge=0)
    processing_time: Optional[int] = Field(default=None, ge=0)
    queue_time: Optional[int] = Field(default=None, ge=0)


class ModelInfo(BaseModel):
    """Information about a model"""
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: Optional[str] = None
    format: Optional[str] = None
    source: Optional[str] = None
    loaded: bool = False
    load_time: Optional[int] = Field(default=None, ge=0)
    memory_usage: Optional[int] = Field(default=None, ge=0)
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    version: Optional[str] = None
    capabilities: Optional[List[str]] = Field(default_factory=list)


class ModelMetrics(BaseModel):
    """Metrics for a specific model"""
    model_config = ConfigDict(extra="allow")
    
    model_id: str
    total_requests: Optional[int] = Field(default=0, ge=0)
    total_tokens: Optional[int] = Field(default=0, ge=0)
    average_latency: Optional[float] = Field(default=0.0, ge=0.0)
    tokens_per_second: Optional[float] = Field(default=0.0, ge=0.0)
    memory_usage: Optional[int] = Field(default=0, ge=0)
    cpu_usage: Optional[float] = Field(default=0.0, ge=0.0, le=100.0)
    last_used: Optional[int] = Field(default=None)
    error_rate: Optional[float] = Field(default=0.0, ge=0.0, le=1.0)


class SystemMetrics(BaseModel):
    """System-wide metrics"""
    model_config = ConfigDict(extra="allow")
    
    cpu_usage: Optional[float] = Field(default=0.0, ge=0.0, le=100.0)
    memory_usage: Optional[int] = Field(default=0, ge=0)
    memory_total: Optional[int] = Field(default=0, ge=0)
    disk_usage: Optional[int] = Field(default=0, ge=0)
    disk_total: Optional[int] = Field(default=0, ge=0)
    active_connections: Optional[int] = Field(default=0, ge=0)
    uptime_seconds: Optional[int] = Field(default=0, ge=0)
    load_average: Optional[float] = Field(default=0.0, ge=0.0)


class ChatMessage(BaseModel):
    """Chat message"""
    model_config = ConfigDict(extra="allow")
    
    role: Literal["user", "assistant", "system"]
    content: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    timestamp: Optional[int] = Field(default=None)


class InferenceRequest(BaseModel):
    """Request for inference"""
    model_config = ConfigDict(extra="allow")
    
    prompt: str
    model_id: Optional[str] = None
    options: Optional[InferenceOptions] = Field(default_factory=InferenceOptions)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    session_id: Optional[str] = None


class InferenceResponse(BaseModel):
    """Response from inference"""
    model_config = ConfigDict(extra="allow")
    
    text: str
    model_id: Optional[str] = None
    metrics: Optional[InferenceMetrics] = None
    success: bool = True
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class StreamingResponse(BaseModel):
    """Streaming response chunk"""
    model_config = ConfigDict(extra="allow")
    
    token: str
    is_complete: bool = False
    model_id: Optional[str] = None
    metrics: Optional[InferenceMetrics] = None
    error: Optional[str] = None


class LoadModelRequest(BaseModel):
    """Request to load a model"""
    model_config = ConfigDict(extra="allow")
    
    source: str
    format: Optional[str] = None
    id: Optional[str] = None
    name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    force_reload: bool = False


class LoadModelResponse(BaseModel):
    """Response from loading a model"""
    model_config = ConfigDict(extra="allow")
    
    success: bool
    message: Optional[str] = None
    model: Optional[ModelInfo] = None
    error: Optional[str] = None


class BatchInferenceRequest(BaseModel):
    """Request for batch inference"""
    model_config = ConfigDict(extra="allow")
    
    requests: List[InferenceRequest]
    max_concurrent: Optional[int] = Field(default=5, ge=1, le=20)
    timeout_ms: Optional[int] = Field(default=30000, ge=1000)
    fail_fast: bool = False
    priority: Optional[str] = None


class BatchInferenceResponse(BaseModel):
    """Response from batch inference"""
    model_config = ConfigDict(extra="allow")
    
    responses: List[InferenceResponse]
    total_requests: int
    successful_requests: int
    failed_requests: int
    total_time_ms: Optional[int] = None
    average_latency_ms: Optional[float] = None
    success: bool = True
    error: Optional[str] = None


class RouterConfig(BaseModel):
    """Configuration for the router client"""
    model_config = ConfigDict(extra="allow")
    
    base_url: str = Field(default="http://localhost:3000")
    grpc_url: Optional[str] = Field(default="localhost:50051")
    websocket_url: Optional[str] = None
    timeout: float = Field(default=30.0, gt=0)
    max_retries: int = Field(default=3, ge=0)
    retry_delay: float = Field(default=1.0, ge=0)
    api_key: Optional[str] = None
    user_agent: str = Field(default="llm-router-python/1.2.1")
    
    @validator('websocket_url', always=True)
    def set_websocket_url(cls, v, values):
        if v is None and 'base_url' in values:
            base = values['base_url']
            return base.replace('http://', 'ws://').replace('https://', 'wss://')
        return v