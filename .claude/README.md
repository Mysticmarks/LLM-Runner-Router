# Claude Code Configuration

This directory contains Claude Code specific configuration, commands, and hooks for the LLM-Runner-Router project.

## Commands

Custom commands for common development tasks:

- **`dev-setup`**: Complete development environment setup including dependencies, git hooks, and test models
- **`test-model`**: Quick test of model loading and inference functionality  
- **`run-benchmarks`**: Comprehensive performance benchmarking suite
- **`analyze-models`**: Analyze available models, cache usage, and performance metrics

### Usage
```bash
# Make commands executable
chmod +x .claude/commands/*

# Run a command
./.claude/commands/dev-setup
```

## Hooks

Automated workflows that run during Claude Code operations:

- **`pre-edit`**: Warnings and checks before editing critical files
- **`post-edit`**: Auto-linting, testing, and documentation updates after edits
- **`pre-bash`**: Safety checks for potentially destructive bash commands
- **`post-bash`**: Error handling and next-step suggestions after command execution

## Settings

The `settings.json` file configures:
- Tool preferences for common operations
- File watchers for automatic actions
- Environment requirements
- Security rules for safe operation
- Key files and test patterns

## Project-Specific Features

This configuration is tailored for LLM model orchestration development:
- Model loading and inference testing
- Performance benchmarking utilities  
- Engine compatibility checks
- Routing strategy validation
- Cache management tools

## Command History

Bash commands executed by Claude are logged to `command-history.log` for debugging and audit purposes.