# Claude Code Base Action Repository

## Repository Overview

**Repository**: [anthropics/claude-code-base-action](https://github.com/anthropics/claude-code-base-action)

**Purpose**: GitHub Action for running Claude Code within GitHub Actions workflows, enabling custom AI-powered automation

This action provides the foundation for building custom workflows using Claude's AI capabilities, offering more control and flexibility than the standard Claude Code Action.

## Key Features

- **Direct prompt execution**: Run specific AI prompts within GitHub workflows
- **File-based prompts**: Use external files for complex prompt management
- **Conversation turn limits**: Control AI interaction length for cost management
- **Custom workflow integration**: Build tailored automation solutions
- **Multiple authentication methods**: Support for various cloud providers

## Authentication Methods

### 1. Direct Anthropic API
```yaml
with:
  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 2. Amazon Bedrock (OIDC)
```yaml
with:
  use_bedrock: true
  # Requires AWS OIDC setup
```

### 3. Google Vertex AI (OIDC)
```yaml
with:
  use_vertex: true
  # Requires Google Cloud OIDC setup
```

## Configuration Inputs

### Core Parameters
- **`prompt`**: Direct text prompt for immediate AI interaction
- **`prompt_file`**: Path to file containing the prompt text
- **`allowed_tools`**: Comma-separated list of permitted tools
- **`model`**: Specific Claude model to use
- **`max_turns`**: Maximum number of conversation turns

### Advanced Configuration
- **`timeout`**: Maximum execution time
- **`github_token`**: GitHub token for repository access
- **`custom_instructions`**: Project-specific AI behavior guidelines

## Basic Usage Example

```yaml
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-base-action@beta
        with:
          prompt: "Review PR changes for code quality, security issues, and best practices"
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## File-Based Prompt Example

```yaml
name: Feature Implementation
on:
  workflow_dispatch:
    inputs:
      feature_description:
        description: 'Feature to implement'
        required: true

jobs:
  implement-feature:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create prompt file
        run: |
          echo "Implement the following feature: ${{ github.event.inputs.feature_description }}" > prompt.txt
          echo "Follow the project's coding standards and add appropriate tests." >> prompt.txt
      - uses: anthropics/claude-code-base-action@beta
        with:
          prompt_file: prompt.txt
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          allowed_tools: "read,write,bash,edit"
          max_turns: 15
```

## Advanced Workflow Example

```yaml
name: Automated Code Analysis
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM

jobs:
  code-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup analysis prompt
        run: |
          cat > analysis_prompt.md << 'EOF'
          # Weekly Code Analysis Task
          
          Please perform the following analysis on this codebase:
          
          1. Identify potential security vulnerabilities
          2. Find code duplication opportunities
          3. Suggest performance improvements
          4. Check for outdated dependencies
          5. Review test coverage gaps
          
          Create a summary report with actionable recommendations.
          EOF
      
      - uses: anthropics/claude-code-base-action@beta
        with:
          prompt_file: analysis_prompt.md
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          allowed_tools: "read,grep,bash"
          model: claude-3-opus-20241022
          max_turns: 20
```

## Tool Configuration

### Available Tools
- **`read`**: Read file contents
- **`write`**: Create and modify files
- **`edit`**: Make targeted file edits
- **`bash`**: Execute shell commands
- **`grep`**: Search through files
- **`glob`**: File pattern matching

### Tool Security
```yaml
# Restrictive tool access for code review
allowed_tools: "read,grep"

# Full access for implementation tasks
allowed_tools: "read,write,edit,bash,grep,glob"

# Custom tool combinations
allowed_tools: "read,edit,bash"
```

## Security Best Practices

### Critical Security Warning
**⚠️ IMPORTANT: Never commit API keys directly to your repository!**

### Secure Configuration
```yaml
# ✅ Correct - Using GitHub Secrets
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

# ❌ Wrong - Never do this
anthropic_api_key: "sk-ant-api03-..."
```

### Permission Management
- Use repository-scoped tokens
- Limit tool access based on task requirements
- Review workflow permissions regularly
- Monitor action execution logs

## Use Cases

### 1. Automated Code Reviews
```yaml
- uses: anthropics/claude-code-base-action@beta
  with:
    prompt: "Review this PR for code quality, security, and maintainability"
    allowed_tools: "read,grep"
```

### 2. Documentation Generation
```yaml
- uses: anthropics/claude-code-base-action@beta
  with:
    prompt: "Generate API documentation for all public functions"
    allowed_tools: "read,write"
```

### 3. Test Generation
```yaml
- uses: anthropics/claude-code-base-action@beta
  with:
    prompt: "Create unit tests for functions missing test coverage"
    allowed_tools: "read,write,bash"
```

### 4. Refactoring Tasks
```yaml
- uses: anthropics/claude-code-base-action@beta
  with:
    prompt: "Refactor duplicated code and improve maintainability"
    allowed_tools: "read,write,edit"
```

## Cost Optimization

### Turn Limits
```yaml
max_turns: 5  # For simple tasks
max_turns: 15 # For complex implementations
max_turns: 25 # For comprehensive analysis
```

### Targeted Tool Usage
```yaml
# Minimize API calls with specific tools
allowed_tools: "read"  # Read-only analysis
allowed_tools: "read,edit"  # Targeted modifications
```

### Efficient Prompting
- Use specific, clear instructions
- Provide context upfront
- Avoid iterative refinement when possible

## Licensing

- **License**: MIT License
- **Open Source**: Freely available for modification and distribution
- **Community Contributions**: Welcomes pull requests and issues

## Beta Status Considerations

This action is in beta, expect:
- **API Evolution**: Input parameters may change
- **Feature Additions**: New capabilities regularly added
- **Performance Improvements**: Ongoing optimization
- **Documentation Updates**: Keep checking for latest practices

## Integration Patterns

### CI/CD Pipeline Integration
```yaml
name: Development Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
  
  ai-review:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-base-action@beta
        with:
          prompt: "Review changes for potential issues"
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Scheduled Maintenance
```yaml
name: Weekly Maintenance
on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday

jobs:
  maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-base-action@beta
        with:
          prompt: "Check for security updates and code improvements"
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```