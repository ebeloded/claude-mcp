# Claude Code Action Repository

## Repository Overview

**Repository**: [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)

**Purpose**: AI-powered GitHub action for code assistance, review, and implementation

This is the main GitHub Action that provides interactive AI assistance for development workflows through GitHub.

## Key Features

1. **Interactive code analysis**: Deep understanding of code context and structure
2. **Automated code reviews**: Consistent and thorough code quality assessment
3. **Code change implementation**: Direct code modifications and improvements
4. **Multi-provider AI model support**: Flexibility in AI infrastructure choice

## Authentication Methods

### 1. Direct Anthropic API (Default)
```yaml
with:
  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 2. Amazon Bedrock (OIDC)
```yaml
with:
  use_bedrock: true
  # OIDC configuration required
```

### 3. Google Vertex AI (OIDC)
```yaml
with:
  use_vertex: true
  # OIDC configuration required
```

## Trigger Mechanisms

- **Default trigger phrase**: `@claude`
- **Supported GitHub events**:
  - `pull_request`
  - `issues`
  - `issue_comment`
  - `pull_request_review_comment`

## Key Capabilities

- **Answer code-related questions**: Provide contextual assistance based on repository content
- **Perform code reviews**: Analyze pull requests for quality, security, and best practices
- **Implement code changes**: Make direct modifications to files and create commits
- **Create commits and PRs**: End-to-end workflow automation
- **Analyze screenshots and visual bugs**: Visual debugging and UI issue resolution

## Security Highlights

- **Commit signatures**: Ensures code integrity and traceability
- **Repository-scoped access**: Limited permissions to specific repositories
- **Requires GitHub secrets for API keys**: Secure credential management
- **Prevents bot/unauthorized triggers**: Protection against misuse

## Configuration Options

- **Custom model selection**: Choose specific Claude models for different tasks
- **Configurable tools**: Define which tools Claude can access
- **Timeout settings**: Control maximum execution time
- **Custom instructions**: Project-specific behavioral guidelines
- **Trigger phrase customization**: Modify activation commands

## Basic Workflow Example

```yaml
name: Claude Assistant
on:
  issue_comment:
    types: [created]

jobs:
  claude-response:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Advanced Configuration Example

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
      - uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          model: claude-3-sonnet-20241022
          max_turns: 10
          allowed_tools: "read,write,bash"
          custom_instructions: "Follow our coding standards in CONTRIBUTING.md"
```

## Usage Patterns

### Issue-to-PR Automation
1. User creates issue describing a feature
2. Comments `@claude implement this feature`
3. Claude analyzes requirements and creates implementation PR

### Code Review Automation
1. Developer opens pull request
2. Claude automatically reviews code changes
3. Provides feedback and suggestions as PR comments

### Bug Fix Assistance
1. User reports bug in issue with reproduction steps
2. Comments `@claude fix this bug`
3. Claude analyzes code, identifies root cause, and implements fix

## Best Practices

- **Use specific instructions**: Provide clear, detailed requests for better results
- **Review AI suggestions**: Always review generated code before merging
- **Set appropriate permissions**: Limit repository access as needed
- **Monitor API usage**: Track costs and optimize usage patterns
- **Keep secrets secure**: Never expose API keys in code or logs

## Beta Considerations

This action is currently in beta, which means:
- **APIs may change**: Workflow configurations might need updates
- **Feature evolution**: New capabilities are regularly added
- **Documentation updates**: Keep checking for latest best practices
- **Community feedback**: Active development based on user input

## Security Best Practices

- Store API keys in GitHub Secrets only
- Use repository-scoped tokens when possible
- Review permissions granted to the action
- Monitor action logs for any unusual activity
- Keep the action version pinned to avoid unexpected changes