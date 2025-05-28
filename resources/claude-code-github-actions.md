# Claude Code GitHub Actions

## Overview

Claude Code GitHub Actions provides AI-powered automation for GitHub workflows, enabling automated code reviews, feature implementation, and bug fixes through simple `@claude` mentions in issues and pull requests.

## Key Features

- **AI-powered GitHub workflow automation**: Automate development tasks using Claude's AI capabilities
- **Create pull requests with a simple `@claude` mention**: Turn issues into PRs with minimal effort
- **Implement features, fix bugs, and review code**: Comprehensive development assistance
- **Follows project-specific guidelines via `CLAUDE.md`**: Respects project conventions and standards
- **Interactive code analysis**: Deep understanding of code context and requirements
- **Multi-provider AI model support**: Flexibility in AI model selection

## Setup Process

1. **Install Claude GitHub App**: Add the Claude GitHub App to your repository
2. **Add API Key**: Add `ANTHROPIC_API_KEY` to your repository secrets
3. **Copy workflow configuration**: Set up the GitHub Actions workflow file

## Authentication Methods

### 1. Direct Anthropic API (Default)
- Requires `ANTHROPIC_API_KEY` in GitHub secrets
- Most straightforward setup method

### 2. Amazon Bedrock (OIDC)
- Enterprise-level control
- Requires AWS OIDC authentication setup
- Suitable for organizations using AWS infrastructure

### 3. Google Vertex AI (OIDC)
- Google Cloud integration
- Requires Google Cloud OIDC authentication
- Good for Google Cloud-based organizations

## Trigger Mechanisms

- **Default trigger phrase**: `@claude`
- **Supported GitHub events**: 
  - Pull requests
  - Issues
  - Comments
  - Issue comments

## Key Capabilities

- **Answer code-related questions**: Provide contextual code assistance
- **Perform code reviews**: Automated code quality analysis
- **Implement code changes**: Direct code modifications and improvements
- **Create commits and PRs**: End-to-end development workflow automation
- **Analyze screenshots and visual bugs**: Visual debugging support

## Example Use Cases

- **Turn issues into PRs**: Automatically implement features described in issues
- **Get implementation guidance**: Receive AI-powered development advice
- **Quickly fix bugs**: Automated bug detection and resolution
- **Code review automation**: Consistent code quality checks

## Configuration Options

- **Custom model selection**: Choose specific Claude models
- **Configurable tools**: Define which tools Claude can use
- **Timeout settings**: Control execution time limits
- **Custom instructions**: Project-specific AI behavior
- **Trigger phrase customization**: Modify the activation phrase
- **Allowed tools**: Specify permitted tools for security
- **Review criteria**: Define code review standards
- **Performance and security parameters**: Fine-tune AI behavior

## Security Recommendations

- **Never commit API keys directly to repository**: Use GitHub Secrets exclusively
- **Use GitHub Secrets**: Store sensitive credentials securely
- **Limit action permissions**: Apply principle of least privilege
- **Review AI suggestions before merging**: Human oversight for critical changes
- **Commit signatures**: Ensure code integrity
- **Repository-scoped access**: Limit access to necessary repositories
- **Prevent bot/unauthorized triggers**: Secure trigger mechanisms

## Cost Considerations

- **Consumes GitHub Actions minutes**: Factor into GitHub Actions usage
- **API token usage varies by task complexity**: Monitor API consumption
- **Optimize by using specific commands**: Reduce costs through targeted usage
- **Set turn limits**: Control conversation length for cost management

## Cloud Provider Integration

- **Supports AWS Bedrock and Google Vertex AI**: Enterprise integration options
- **Requires specific authentication setup**: OIDC configuration needed
- **Enables enterprise-level control**: Suitable for large organizations

## Beta Status

The integration is currently in beta, with features potentially evolving. Users should expect:
- Ongoing feature development
- Potential API changes
- Regular updates and improvements

## Related Repositories

- [Claude Code Action](https://github.com/anthropics/claude-code-action)
- [Claude Code Base Action](https://github.com/anthropics/claude-code-base-action)