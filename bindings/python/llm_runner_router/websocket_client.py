"""
WebSocket client for LLM Router
"""

import json
import asyncio
from typing import AsyncIterator, Dict, Any, Optional, Callable
import websockets
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from .models import (
    InferenceRequest,
    InferenceResponse,
    StreamingResponse,
    RouterConfig,
)
from .exceptions import WebSocketError, TimeoutError, NetworkError

logger = structlog.get_logger(__name__)


class WebSocketClient:
    """
    WebSocket client for real-time communication with LLM Router
    """
    
    def __init__(self, config: Optional[RouterConfig] = None):
        self.config = config or RouterConfig()
        self._websocket: Optional[websockets.WebSocketServerProtocol] = None
        self._message_id = 0
        self._pending_requests: Dict[str, asyncio.Future] = {}
        self._event_handlers: Dict[str, Callable] = {}
        self._background_task: Optional[asyncio.Task] = None
        
        logger.info("Initialized WebSocket client", url=self.config.websocket_url)
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def connect(self):
        """Connect to WebSocket server"""
        if self._websocket is not None:
            return
        
        try:
            headers = {}
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            
            # Connect to WebSocket
            self._websocket = await websockets.connect(
                self.config.websocket_url,
                extra_headers=headers,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=5,
            )
            
            # Start background task to handle incoming messages
            self._background_task = asyncio.create_task(self._message_handler())
            
            logger.info("WebSocket connected", url=self.config.websocket_url)
            
        except Exception as e:
            raise WebSocketError(f"Failed to connect to WebSocket: {e}", original_error=e)
    
    async def close(self):
        """Close WebSocket connection"""
        if self._background_task:
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass
            self._background_task = None
        
        if self._websocket:
            await self._websocket.close()
            self._websocket = None
            
        # Cancel any pending requests
        for future in self._pending_requests.values():
            future.cancel()
        self._pending_requests.clear()
        
        logger.info("WebSocket closed")
    
    async def _message_handler(self):
        """Background task to handle incoming WebSocket messages"""
        try:
            async for message in self._websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError as e:
                    logger.warning("Failed to parse WebSocket message", message=message, error=str(e))
                except Exception as e:
                    logger.error("Error handling WebSocket message", error=str(e))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
        except Exception as e:
            logger.error("WebSocket message handler error", error=str(e))
    
    async def _handle_message(self, data: Dict[str, Any]):
        """Handle incoming WebSocket message"""
        message_type = data.get("type")
        message_id = data.get("id")
        
        if message_type == "response" and message_id:
            # Response to a request
            future = self._pending_requests.pop(message_id, None)
            if future and not future.cancelled():
                if data.get("error"):
                    future.set_exception(WebSocketError(data["error"]))
                else:
                    future.set_result(data.get("data", {}))
        
        elif message_type == "stream":
            # Streaming data
            await self._handle_stream_message(data)
        
        elif message_type == "event":
            # Event notification
            event_name = data.get("event")
            handler = self._event_handlers.get(event_name)
            if handler:
                try:
                    await handler(data.get("data", {}))
                except Exception as e:
                    logger.error("Event handler error", event=event_name, error=str(e))
        
        else:
            logger.warning("Unknown message type", type=message_type, data=data)
    
    async def _handle_stream_message(self, data: Dict[str, Any]):
        """Handle streaming message"""
        stream_id = data.get("stream_id")
        if stream_id in self._pending_requests:
            future = self._pending_requests[stream_id]
            if not future.cancelled():
                # For streaming, we use the future to store a queue
                if not hasattr(future, '_stream_queue'):
                    future._stream_queue = asyncio.Queue()
                
                await future._stream_queue.put(data.get("data", {}))
                
                # Check if stream is complete
                if data.get("complete", False):
                    await future._stream_queue.put(None)  # Sentinel for end of stream
    
    def on_event(self, event_name: str, handler: Callable):
        """Register event handler"""
        self._event_handlers[event_name] = handler
        logger.info("Registered event handler", event=event_name)
    
    async def _send_request(self, request_type: str, data: Dict[str, Any]) -> Any:
        """Send request and wait for response"""
        if not self._websocket:
            await self.connect()
        
        message_id = str(self._message_id)
        self._message_id += 1
        
        message = {
            "type": "request",
            "id": message_id,
            "request_type": request_type,
            "data": data,
        }
        
        # Create future for response
        future = asyncio.Future()
        self._pending_requests[message_id] = future
        
        try:
            await self._websocket.send(json.dumps(message))
            
            # Wait for response with timeout
            response = await asyncio.wait_for(future, timeout=self.config.timeout)
            return response
            
        except asyncio.TimeoutError:
            self._pending_requests.pop(message_id, None)
            raise TimeoutError(f"WebSocket request timeout: {request_type}")
        except Exception as e:
            self._pending_requests.pop(message_id, None)
            raise WebSocketError(f"WebSocket request failed: {e}", original_error=e)
    
    async def inference(self, request: InferenceRequest) -> InferenceResponse:
        """Perform inference via WebSocket"""
        logger.info("WebSocket inference", model_id=request.model_id)
        
        data = request.model_dump()
        response_data = await self._send_request("inference", data)
        
        return InferenceResponse(**response_data)
    
    async def stream_inference(self, request: InferenceRequest) -> AsyncIterator[StreamingResponse]:
        """Stream inference via WebSocket"""
        logger.info("WebSocket stream inference", model_id=request.model_id)
        
        if not self._websocket:
            await self.connect()
        
        stream_id = str(self._message_id)
        self._message_id += 1
        
        # Ensure streaming is enabled
        data = request.model_dump()
        if not data.get("options"):
            data["options"] = {}
        data["options"]["stream"] = True
        
        message = {
            "type": "stream_request",
            "id": stream_id,
            "request_type": "inference",
            "data": data,
        }
        
        # Create future with stream queue
        future = asyncio.Future()
        future._stream_queue = asyncio.Queue()
        self._pending_requests[stream_id] = future
        
        try:
            await self._websocket.send(json.dumps(message))
            
            # Yield streaming responses
            while True:
                try:
                    chunk_data = await asyncio.wait_for(
                        future._stream_queue.get(), 
                        timeout=self.config.timeout
                    )
                    
                    if chunk_data is None:  # End of stream
                        break
                    
                    yield StreamingResponse(**chunk_data)
                    
                except asyncio.TimeoutError:
                    raise TimeoutError("WebSocket stream timeout")
                    
        except Exception as e:
            raise WebSocketError(f"WebSocket streaming failed: {e}", original_error=e)
        finally:
            self._pending_requests.pop(stream_id, None)
    
    async def load_model(self, source: str, **options) -> Dict[str, Any]:
        """Load model via WebSocket"""
        logger.info("WebSocket load model", source=source)
        
        data = {
            "source": source,
            **options
        }
        
        return await self._send_request("load_model", data)
    
    async def list_models(self) -> Dict[str, Any]:
        """List models via WebSocket"""
        logger.info("WebSocket list models")
        return await self._send_request("list_models", {})
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check via WebSocket"""
        logger.info("WebSocket health check")
        return await self._send_request("health", {})
    
    async def join_room(self, room: str):
        """Join a WebSocket room for group communication"""
        logger.info("Joining WebSocket room", room=room)
        await self._send_request("join_room", {"room": room})
    
    async def leave_room(self, room: str):
        """Leave a WebSocket room"""
        logger.info("Leaving WebSocket room", room=room)
        await self._send_request("leave_room", {"room": room})
    
    async def send_to_room(self, room: str, message: Dict[str, Any]):
        """Send message to WebSocket room"""
        logger.info("Sending to WebSocket room", room=room)
        await self._send_request("send_to_room", {"room": room, "message": message})
    
    def __repr__(self) -> str:
        return f"WebSocketClient(url='{self.config.websocket_url}')"