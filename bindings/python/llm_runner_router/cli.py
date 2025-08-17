"""
Command-line interface for LLM Router
"""

import argparse
import asyncio
import json
import sys
from typing import Optional, Dict, Any

import structlog
from .async_client import AsyncLLMRouterClient
from .models import RouterConfig, InferenceRequest, LoadModelRequest, InferenceOptions


def setup_logging(verbose: bool = False):
    """Setup structured logging"""
    log_level = "DEBUG" if verbose else "INFO"
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        level=log_level,
    )


async def health_command(client: AsyncLLMRouterClient) -> int:
    """Health check command"""
    try:
        result = await client.health_check()
        print(json.dumps(result, indent=2))
        return 0
    except Exception as e:
        print(f"Health check failed: {e}", file=sys.stderr)
        return 1


async def status_command(client: AsyncLLMRouterClient) -> int:
    """Status command"""
    try:
        result = await client.get_status()
        print(json.dumps(result, indent=2))
        return 0
    except Exception as e:
        print(f"Status check failed: {e}", file=sys.stderr)
        return 1


async def models_command(client: AsyncLLMRouterClient, include_unloaded: bool = False) -> int:
    """List models command"""
    try:
        models = await client.list_models(include_unloaded=include_unloaded)
        models_data = [model.model_dump() for model in models]
        print(json.dumps(models_data, indent=2))
        return 0
    except Exception as e:
        print(f"Failed to list models: {e}", file=sys.stderr)
        return 1


async def load_command(
    client: AsyncLLMRouterClient, 
    source: str, 
    format: Optional[str] = None,
    model_id: Optional[str] = None,
    name: Optional[str] = None
) -> int:
    """Load model command"""
    try:
        request = LoadModelRequest(
            source=source,
            format=format,
            id=model_id,
            name=name
        )
        result = await client.load_model(request)
        print(json.dumps(result.model_dump(), indent=2))
        return 0 if result.success else 1
    except Exception as e:
        print(f"Failed to load model: {e}", file=sys.stderr)
        return 1


async def infer_command(
    client: AsyncLLMRouterClient,
    prompt: str,
    model_id: Optional[str] = None,
    max_tokens: int = 500,
    temperature: float = 0.7,
    stream: bool = False
) -> int:
    """Inference command"""
    try:
        options = InferenceOptions(
            max_tokens=max_tokens,
            temperature=temperature,
            stream=stream
        )
        
        request = InferenceRequest(
            prompt=prompt,
            model_id=model_id,
            options=options
        )
        
        if stream:
            # Streaming inference
            async for chunk in client.stream_inference(request):
                if chunk.token:
                    print(chunk.token, end='', flush=True)
                if chunk.error:
                    print(f"\nError: {chunk.error}", file=sys.stderr)
                    return 1
                if chunk.is_complete:
                    print()  # New line at end
                    break
        else:
            # Single inference
            result = await client.inference(request)
            if result.success:
                print(result.text)
            else:
                print(f"Inference failed: {result.error}", file=sys.stderr)
                return 1
        
        return 0
    except Exception as e:
        print(f"Inference failed: {e}", file=sys.stderr)
        return 1


async def chat_command(
    client: AsyncLLMRouterClient,
    model_id: Optional[str] = None,
    max_tokens: int = 500,
    temperature: float = 0.7
) -> int:
    """Interactive chat command"""
    print("LLM Router Chat Interface")
    print("Type 'quit' or 'exit' to end the chat\n")
    
    try:
        while True:
            try:
                prompt = input("You: ").strip()
                if prompt.lower() in ['quit', 'exit']:
                    break
                
                if not prompt:
                    continue
                
                options = InferenceOptions(
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stream=True
                )
                
                request = InferenceRequest(
                    prompt=prompt,
                    model_id=model_id,
                    options=options
                )
                
                print("Assistant: ", end='', flush=True)
                
                async for chunk in client.stream_inference(request):
                    if chunk.token:
                        print(chunk.token, end='', flush=True)
                    if chunk.error:
                        print(f"\nError: {chunk.error}", file=sys.stderr)
                        break
                    if chunk.is_complete:
                        print("\n")
                        break
                        
            except KeyboardInterrupt:
                print("\n\nChat interrupted by user")
                break
            except EOFError:
                print("\n\nEnd of input")
                break
        
        return 0
    except Exception as e:
        print(f"Chat failed: {e}", file=sys.stderr)
        return 1


def create_parser() -> argparse.ArgumentParser:
    """Create CLI argument parser"""
    parser = argparse.ArgumentParser(
        description="LLM Router Command Line Interface",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  llm-router health
  llm-router models --include-unloaded
  llm-router load ./model.gguf --format gguf --id my-model
  llm-router infer "What is the capital of France?" --model my-model
  llm-router infer "Tell me a story" --stream
  llm-router chat --model my-model
        """
    )
    
    parser.add_argument(
        "--url", 
        default="http://localhost:3000",
        help="LLM Router server URL (default: http://localhost:3000)"
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="Request timeout in seconds (default: 30)"
    )
    parser.add_argument(
        "--api-key",
        help="API key for authentication"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Health check
    subparsers.add_parser("health", help="Check server health")
    
    # Status
    subparsers.add_parser("status", help="Get server status")
    
    # Models
    models_parser = subparsers.add_parser("models", help="List models")
    models_parser.add_argument(
        "--include-unloaded",
        action="store_true",
        help="Include unloaded models"
    )
    
    # Load model
    load_parser = subparsers.add_parser("load", help="Load a model")
    load_parser.add_argument("source", help="Model source path or URL")
    load_parser.add_argument("--format", help="Model format (gguf, onnx, etc.)")
    load_parser.add_argument("--id", help="Model ID")
    load_parser.add_argument("--name", help="Model name")
    
    # Inference
    infer_parser = subparsers.add_parser("infer", help="Run inference")
    infer_parser.add_argument("prompt", help="Input prompt")
    infer_parser.add_argument("--model", help="Model ID to use")
    infer_parser.add_argument("--max-tokens", type=int, default=500, help="Maximum tokens to generate")
    infer_parser.add_argument("--temperature", type=float, default=0.7, help="Sampling temperature")
    infer_parser.add_argument("--stream", action="store_true", help="Enable streaming")
    
    # Chat
    chat_parser = subparsers.add_parser("chat", help="Interactive chat")
    chat_parser.add_argument("--model", help="Model ID to use")
    chat_parser.add_argument("--max-tokens", type=int, default=500, help="Maximum tokens to generate")
    chat_parser.add_argument("--temperature", type=float, default=0.7, help="Sampling temperature")
    
    return parser


async def main():
    """Main CLI entry point"""
    parser = create_parser()
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Create client configuration
    config = RouterConfig(
        base_url=args.url,
        timeout=args.timeout,
        api_key=args.api_key
    )
    
    # Execute command
    async with AsyncLLMRouterClient(config) as client:
        if args.command == "health":
            return await health_command(client)
        elif args.command == "status":
            return await status_command(client)
        elif args.command == "models":
            return await models_command(client, args.include_unloaded)
        elif args.command == "load":
            return await load_command(client, args.source, args.format, args.id, args.name)
        elif args.command == "infer":
            return await infer_command(
                client, args.prompt, args.model, 
                args.max_tokens, args.temperature, args.stream
            )
        elif args.command == "chat":
            return await chat_command(client, args.model, args.max_tokens, args.temperature)
        else:
            print(f"Unknown command: {args.command}", file=sys.stderr)
            return 1


def cli_main():
    """Synchronous CLI entry point"""
    try:
        return asyncio.run(main())
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        return 130
    except Exception as e:
        print(f"CLI error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(cli_main())