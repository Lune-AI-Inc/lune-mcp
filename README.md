# Lune Model Context Protocol

The Lune [Model Context Protocol](https://modelcontextprotocol.com/) server allows you to integrate with individual [Lunes](https://www.lune.dev/lunes) (knowledge bases composed of documentation, code repositories, forum discussions, etc.) through function calling.

Lunes are currently to assist agents and LLMs with codegen and are not for interfacing with their respective APIs. Please refer to other amazing MCP servers, like [Stripe's](https://github.com/stripe/agent-toolkit/tree/main/modelcontextprotocol) for that.

## Setup

To run a Lune MCP server using npx, first go to the [Lunes](https://www.lune.dev/lunes) and find click "Use MCP" for the Lunes you want to use which will copy the command to your clipboard like below. Make sure to replace `YOUR_LUNE_API_KEY` with your actual Lune API key which you can grab at [https://www.lune.dev/profile](https://www.lune.dev/profile).

```bash
# Replace YOUR_LUNE_API_KEY with your actual Lune API key
npx -y @lune/mcp --api-key=YOUR_LUNE_API_KEY --lune-name=LUNE_NAME --lune-id=LUNE_ID
```

Example with the Lune on Model Context Protocol Docs, check out the Lune here: [https://www.lune.dev/lunes/v-model-context-protocol-mcp](https://www.lune.dev/lunes/v-model-context-protocol-mcp):

```bash
npx -y @lune/mcp --api-key=YOUR_LUNE_API_KEY --lune-name=MCP --lune-id=c2d40d37-9432-44e4-bc78-88b3e251bde1
```


## Transport Options

The Lune MCP server supports two transport methods:

### 1. Standard Input/Output (stdio) - Default

This is the default transport method and is used when no transport is specified:

```bash
npx -y @lune/mcp --api-key=YOUR_LUNE_API_KEY --lune-name=LUNE_NAME --lune-id=LUNE_ID
```

### 2. Server-Sent Events (SSE)

To use SSE transport, specify the `--transport=sse` flag and optionally a port (default is 3000):

```bash
npx -y @lune/mcp --api-key=YOUR_LUNE_API_KEY --lune-name=LUNE_NAME --lune-id=LUNE_ID --transport=sse --port=3000
```

When using SSE transport:
- Connect to `/sse` to establish an SSE connection
- Send messages to `/messages`

### Usage in Cursor

You can either use it in SSE mode or stdio mode.

Open Cursor Settings, find features, and add the following:

#### Stdio Mode

Name: `lune-[LUNE_NAME]-mcp`

Type: `command`

```bash
npx -y @lune/mcp --api-key=YOUR_LUNE_API_KEY --lune-name=LUNE_NAME --lune-id=LUNE_ID
```
(Going to [https://www.lune.dev/lunes](https://www.lune.dev/lunes) and clicking "Use MCP" will copy this command to your clipboard)

#### SSE Mode

Name: `lune-[LUNE_NAME]-mcp`

Type: `sse`

Run the previous instructions for SSE mode, and then put in the following:

`http://localhost:3000/sse`

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`. See [here](https://modelcontextprotocol.io/quickstart/user) for more details.

```
{
    "mcpServers": {
        "lune": {
            "command": "npx",
            "args": [
                "-y",
                "@lune/mcp",
                "--api-key=LUNE_API_KEY",
                "--lune-name=LUNE_NAME",
                "--lune-id=LUNE_ID"
            ]
        }
    }
}
```

### Usage with Windsurf and other tools

Similar to instructions for Cursor and Claude Desktop. 

## Debugging the Server

To debug your server, you can use the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector).

First build the server

```
npm run build
```

Run the following command in your terminal:

```bash
# Start MCP Inspector and server with all tools
npx @modelcontextprotocol/inspector node dist/index.js --api-key=YOUR_LUNE_API_KEY --lune-name=LUNE_NAME --lune-id=LUNE_ID
```

### Instructions

1. Replace `YOUR_LUNE_API_KEY` with your actual Lune API key.
2. Run the command to start the MCP Inspector.
3. Open the MCP Inspector UI in your browser and click Connect to start the MCP server.
4. You can see the list of tools you selected and test each tool individually.

## Environment Variables

You can also configure the server using environment variables:

- `LUNE_API_KEY`: Your Lune API key
- `LUNE_NAME`: The name of the Lune
- `LUNE_ID`: The ID of the Lune
- `TRANSPORT`: The transport method to use (`stdio` or `sse`)
- `PORT`: The port to use for SSE transport (default: 3000)