#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { green, red, yellow } from "colors";
import express from "express";

declare module "@modelcontextprotocol/sdk/server/mcp.js" {
  interface RequestHandlerExtra {
    apiKey: string;
  }
}

const LUNE_API_BASE = "https://api.lune.dev";
const USER_AGENT = "lune-mcp/1.0";

let globalApiKey: string;
let lune_name: string;
let lune_id: string;

// Helper function for making Lune API requests
async function makeLuneRequest(query: string, luneId: string, apiKey: string): Promise<{ content: string; statusCode?: number } | null> {
  const url = `${LUNE_API_BASE}/chat/get_chunks_from_lunes`;
  const headers = {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_query: query, lune_ids: [luneId]}),
    });
    
    if (!response.ok) {
      return { content: "", statusCode: response.status };
    }
    
    const data = await response.json();
    
    // Check if chunks exists and is an array
    if (!data.chunks || !Array.isArray(data.chunks)) {
      throw new Error("Invalid response format: chunks missing or not an array");
    }

    // Format the chunks into a single string
    const formattedContext = data.chunks
      .map((chunk: { content: string; source?: string }) => {
        return `${chunk.content}\nSource: ${chunk.source || 'Unknown'}`;
      })
      .join('\n\n');
    return { content: formattedContext || "No relevant context found" };
  } catch (error) {
    console.error("Error making Lune request:", error);
    return null;
  }
}

// Parse command line arguments
function parseArgs(args: string[]): { 
  apiKey: string; 
  luneName: string; 
  luneId: string; 
  transport: "stdio" | "sse"; 
  port: number;
} {
  const options: { 
    apiKey?: string; 
    luneName?: string; 
    luneId?: string; 
    transport?: "stdio" | "sse";
    port?: number;
  } = {};

  args.forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (key === "api-key") {
        options.apiKey = value;
      } else if (key === "lune-name") {
        options.luneName = value;
      } else if (key === "lune-id") {
        options.luneId = value;
      } else if (key === "transport") {
        if (value !== "stdio" && value !== "sse") {
          throw new Error(`Invalid transport: ${value}. Accepted values: stdio, sse`);
        }
        options.transport = value;
      } else if (key === "port") {
        const port = parseInt(value, 10);
        if (isNaN(port)) {
          throw new Error(`Invalid port: ${value}. Port must be a number.`);
        }
        options.port = port;
      } else {
        throw new Error(`Invalid argument: ${key}. Accepted arguments: --api-key, --lune-name, --lune-id, --transport, --port`);
      }
    }
  });

  const apiKey = options.apiKey || process.env.LUNE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Lune API key not provided. Please either pass it as --api-key=YOUR_KEY or set the LUNE_API_KEY environment variable."
    );
  }

  const luneName = options.luneName || process.env.LUNE_NAME;
  if (!luneName) {
    throw new Error(
      "Lune name not provided. Please either pass it as --lune-name=YOUR_LUNE_NAME or set the LUNE_NAME environment variable."
    );
  }

  const luneId = options.luneId || process.env.LUNE_ID;
  if (!luneId) {
    throw new Error(
      "Lune ID not provided. Please either pass it as --lune-id=YOUR_LUNE_ID or set the LUNE_ID environment variable."
    );
  }

  const transport = (options.transport || process.env.TRANSPORT || "stdio") as "stdio" | "sse";
  const port = options.port || parseInt(process.env.PORT || "3000", 10);

  return { apiKey, luneName, luneId, transport, port };
}

function handleError(error: any) {
  console.error(red("\n🚨  Error initializing Lune MCP server:\n"));
  console.error(yellow(`   ${error.message}\n`));
}

const server = new McpServer({
  name: "lune",
  version: "1.0.0",
});

// Start the server
async function main() {
  try {
    const { apiKey, luneName, luneId, transport, port } = parseArgs(process.argv.slice(2));
    globalApiKey = apiKey;
    lune_name = luneName;
    lune_id = luneId;
    
    // Define the tool after we have the lune_name and lune_id values
    server.tool(
      `lookup_context_for_${lune_name}`,
      "Look up up-to-date technical context for specific APIs, libraries, packages, and more via Lune, from documentation, discussions, code repositories, and more.",
      {
        user_query: z.string().describe(`A user's query, used to get relevant context on ${lune_name} pulling from docs, relevant repositories, forum discussions, and more.`),
      },
      async ({ user_query }) => {
        const result = await makeLuneRequest(user_query, lune_id, globalApiKey);

        if (!result) {
          return {
            content: [
              {
                type: "text",
                text: "Failed to retrieve context from Lune API",
              },
            ],
          };
        }
        
        if (result.statusCode === 402) {
          return {
            content: [
              {
                type: "text",
                text: "Error, you have exceeded your free quota. Please upgrade to a paid plan at https://www.lune.dev/profile/plan for more MCP requests.",
              },
            ],
          };
        }
        
        if (result.statusCode) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to retrieve context from Lune API: HTTP error ${result.statusCode}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Context for "${user_query}":\n\n${result.content}`,
            },
          ],
        };
      }
    );
    
    if (transport === "stdio") {
      // Use stdio transport
      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);
      console.error(green("✅ Lune MCP Server running on stdio"));
    } else if (transport === "sse") {
      // Use SSE transport with Express
      const app = express();
      let sseTransport: SSEServerTransport | null = null;

      app.get("/sse", (req, res) => {
        sseTransport = new SSEServerTransport("/messages", res);
        server.connect(sseTransport);
        console.error(green(`✅ SSE connection established`));
      });

      app.post("/messages", (req, res) => {
        if (sseTransport) {
          sseTransport.handlePostMessage(req, res);
        } else {
          res.status(400).send("SSE connection not established");
        }
      });

      app.listen(port, () => {
        console.error(green(`✅ Lune MCP Server running on SSE at http://localhost:${port}`));
        console.error(green(`   - Connect to /sse to establish SSE connection`));
        console.error(green(`   - Send messages to /messages`));
      });
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}