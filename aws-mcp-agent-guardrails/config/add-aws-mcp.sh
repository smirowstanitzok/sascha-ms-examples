# config/add-aws-mcp.sh
# Registers the AWS MCP Server (Frankfurt endpoint) in Claude Code with the restricted "agent" profile.
claude mcp add-json aws-mcp '{"type":"stdio","command":"uvx","args":["mcp-proxy-for-aws-cli@latest","https://aws-mcp.eu-central-1.api.aws/mcp","--metadata","AWS_REGION=eu-central-1"],"env":{"AWS_PROFILE":"agent"}}'
