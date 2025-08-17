#!/usr/bin/env python3
"""
Setup script for LLM Runner Router Python bindings
"""

from setuptools import setup, find_packages
import os

# Read README file
def read_readme():
    try:
        with open("README.md", "r", encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return "LLM Runner Router Python client library"

# Read requirements
def read_requirements():
    try:
        with open("requirements.txt", "r", encoding="utf-8") as fh:
            return [line.strip() for line in fh if line.strip() and not line.startswith("#")]
    except FileNotFoundError:
        return [
            "httpx>=0.25.0",
            "websockets>=12.0",
            "pydantic>=2.5.0",
            "grpcio>=1.60.0",
            "grpcio-tools>=1.60.0",
            "protobuf>=4.25.0",
            "asyncio-throttle>=1.0.2",
            "structlog>=23.2.0",
            "tenacity>=8.2.0",
            "python-multipart>=0.0.6"
        ]

setup(
    name="llm-runner-router",
    version="1.2.1",
    description="Universal LLM model loader and inference router - Python client",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    author="Echo AI Systems",
    author_email="contact@echoai.systems",
    url="https://github.com/MCERQUA/LLM-Runner-Router",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=read_requirements(),
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.1.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
            "mypy>=1.7.0",
            "isort>=5.12.0",
        ],
        "docs": [
            "sphinx>=7.2.0",
            "sphinx-rtd-theme>=1.3.0",
            "sphinx-autodoc-typehints>=1.25.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "llm-router=llm_runner_router.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "llm_runner_router": ["py.typed", "*.pyi"],
    },
    keywords=[
        "llm", "ai", "machine-learning", "inference", 
        "gguf", "onnx", "model-loader", "router", 
        "enterprise", "grpc", "async"
    ],
    project_urls={
        "Bug Reports": "https://github.com/MCERQUA/LLM-Runner-Router/issues",
        "Source": "https://github.com/MCERQUA/LLM-Runner-Router",
        "Documentation": "https://llm-runner-router.readthedocs.io/",
    },
)