#!/usr/bin/env python3
"""
Tests for LLM Router Python client
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
import httpx

from llm_runner_router import (
    AsyncLLMRouterClient,
    LLMRouterClient,
    InferenceRequest,
    LoadModelRequest,
    InferenceOptions,
    RouterConfig,
    InferenceResponse,
    LoadModelResponse,
    ModelInfo,
    LLMRouterError,
    NetworkError,
    TimeoutError,
)


@pytest.fixture
def config():
    """Test configuration"""
    return RouterConfig(
        base_url="http://test-server:3000",
        timeout=10.0,
        api_key="test-key"
    )


@pytest.fixture
def mock_response():
    """Mock HTTP response"""
    response = Mock()
    response.status_code = 200
    response.json.return_value = {
        "text": "Test response",
        "model_id": "test-model",
        "success": True
    }
    return response


class TestAsyncClient:
    """Test AsyncLLMRouterClient"""
    
    @pytest.mark.asyncio
    async def test_client_initialization(self, config):
        """Test client initialization"""
        client = AsyncLLMRouterClient(config)
        assert client.config.base_url == "http://test-server:3000"
        assert client.config.timeout == 10.0
        assert client.config.api_key == "test-key"
    
    @pytest.mark.asyncio
    async def test_health_check(self, config):
        """Test health check"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"status": "healthy"}
            mock_client.get.return_value = mock_response
            
            client = AsyncLLMRouterClient(config)
            await client.start()
            
            result = await client.health_check()
            assert result["status"] == "healthy"
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_inference(self, config):
        """Test inference request"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "text": "Test response",
                "model_id": "test-model",
                "success": True
            }
            mock_client.post.return_value = mock_response
            
            client = AsyncLLMRouterClient(config)
            await client.start()
            
            request = InferenceRequest(
                prompt="Test prompt",
                model_id="test-model"
            )
            
            response = await client.inference(request)
            assert isinstance(response, InferenceResponse)
            assert response.text == "Test response"
            assert response.model_id == "test-model"
            assert response.success is True
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_quick_inference(self, config):
        """Test quick inference"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "text": "Quick response",
                "success": True
            }
            mock_client.post.return_value = mock_response
            
            client = AsyncLLMRouterClient(config)
            await client.start()
            
            response = await client.quick_inference("What is AI?", max_tokens=100)
            assert response.text == "Quick response"
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_list_models(self, config):
        """Test list models"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "models": [
                    {
                        "id": "model1",
                        "name": "Test Model 1",
                        "format": "gguf",
                        "loaded": True
                    },
                    {
                        "id": "model2",
                        "name": "Test Model 2",
                        "format": "onnx",
                        "loaded": False
                    }
                ]
            }
            mock_client.get.return_value = mock_response
            
            client = AsyncLLMRouterClient(config)
            await client.start()
            
            models = await client.list_models()
            assert len(models) == 2
            assert models[0].id == "model1"
            assert models[1].id == "model2"
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_load_model(self, config):
        """Test load model"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "success": True,
                "message": "Model loaded",
                "model": {
                    "id": "new-model",
                    "name": "New Model",
                    "format": "gguf",
                    "loaded": True
                }
            }
            mock_client.post.return_value = mock_response
            
            client = AsyncLLMRouterClient(config)
            await client.start()
            
            request = LoadModelRequest(
                source="./test-model.gguf",
                format="gguf",
                id="new-model"
            )
            
            response = await client.load_model(request)
            assert response.success is True
            assert response.model.id == "new-model"
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_error_handling(self, config):
        """Test error handling"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            # Test 404 error
            mock_response = Mock()
            mock_response.status_code = 404
            mock_response.json.return_value = {"error": "Model not found"}
            mock_client.get.return_value = mock_response
            
            client = AsyncLLMRouterClient(config)
            await client.start()
            
            with pytest.raises(LLMRouterError) as exc_info:
                await client.health_check()
            
            assert exc_info.value.status_code == 404
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_timeout_error(self, config):
        """Test timeout handling"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            # Simulate timeout
            mock_client.get.side_effect = httpx.TimeoutException("Request timeout")
            
            client = AsyncLLMRouterClient(config)
            await client.start()
            
            with pytest.raises(TimeoutError):
                await client.health_check()
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_context_manager(self, config):
        """Test context manager usage"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            
            async with AsyncLLMRouterClient(config) as client:
                assert client._client is not None
            
            # Client should be closed after context
            assert client._client is None


class TestSyncClient:
    """Test LLMRouterClient (synchronous wrapper)"""
    
    def test_sync_client_initialization(self, config):
        """Test sync client initialization"""
        client = LLMRouterClient(config)
        assert client.config.base_url == "http://test-server:3000"
    
    @patch('llm_runner_router.client.asyncio.new_event_loop')
    @patch('llm_runner_router.async_client.httpx.AsyncClient')
    def test_sync_health_check(self, mock_client_class, mock_loop_class, config):
        """Test sync health check"""
        mock_loop = Mock()
        mock_loop_class.return_value = mock_loop
        mock_loop.run_until_complete.return_value = {"status": "healthy"}
        
        mock_client = AsyncMock()
        mock_client_class.return_value = mock_client
        
        client = LLMRouterClient(config)
        result = client.health_check()
        
        assert result["status"] == "healthy"
    
    def test_context_manager(self, config):
        """Test sync client context manager"""
        with patch('llm_runner_router.client.asyncio.new_event_loop'):
            with LLMRouterClient(config) as client:
                assert client is not None


class TestModels:
    """Test data models"""
    
    def test_inference_request_validation(self):
        """Test inference request validation"""
        # Valid request
        request = InferenceRequest(
            prompt="Test prompt",
            model_id="test-model",
            options=InferenceOptions(max_tokens=100, temperature=0.5)
        )
        assert request.prompt == "Test prompt"
        assert request.options.max_tokens == 100
        assert request.options.temperature == 0.5
    
    def test_inference_options_validation(self):
        """Test inference options validation"""
        # Test temperature bounds
        with pytest.raises(ValueError):
            InferenceOptions(temperature=3.0)  # Too high
        
        with pytest.raises(ValueError):
            InferenceOptions(temperature=-1.0)  # Too low
        
        # Valid options
        options = InferenceOptions(
            max_tokens=200,
            temperature=0.8,
            top_p=0.9
        )
        assert options.max_tokens == 200
        assert options.temperature == 0.8
        assert options.top_p == 0.9
    
    def test_model_info(self):
        """Test model info model"""
        model = ModelInfo(
            id="test-model",
            name="Test Model",
            format="gguf",
            loaded=True,
            capabilities=["text-generation"]
        )
        assert model.id == "test-model"
        assert model.loaded is True
        assert "text-generation" in model.capabilities


class TestUtilities:
    """Test utility functions"""
    
    def test_convenience_functions(self):
        """Test convenience functions"""
        from llm_runner_router.client import quick_inference, load_and_infer
        
        # These would require a running server, so we just test they exist
        assert callable(quick_inference)
        assert callable(load_and_infer)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])