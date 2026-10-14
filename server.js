import express from "express";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.PORT || 8080);
const zeaburToken = process.env.ZEABUR_TOKEN;
const mcpAccessToken = process.env.MCP_ACCESS_TOKEN;

function safeTokenMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthorized(req) {
  const header = req.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return Boolean(match && safeTokenMatch(match[1], mcpAccessToken));
}

async function zeaburGraphQL(query, variables = {}) {
  if (!zeaburToken) throw new Error("ZEABUR_TOKEN is not configured");
  const response = await fetch("https://api.zeabur.com/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${zeaburToken}`
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Zeabur API returned HTTP ${response.status}`);
  }
  if (Array.isArray(body.errors) && body.errors.length) {
    throw new Error("Zeabur GraphQL request failed: " +
      body.errors.map((item) => item.message || "Unknown GraphQL error").join("; "));
  }
  return body.data;
}

function createMcpServer() {
  const server = new McpServer({
    name: "zeabur-remote-mcp",
    version: "1.0.0"
  });

  server.registerTool(
    "zeabur_me",
    {
      title: "Verify Zeabur API access",
      description: "Read the authenticated Zeabur account identity. This tool does not change resources.",
      inputSchema: {}
    },
    async () => {
      const data = await zeaburGraphQL("query { me { username } }");
      const username = data?.me?.username;
      if (typeof username !== "string" || !username) {
        throw new Error("Zeabur API responded, but the expected account identity was not present.");
      }
      return {
        content: [{ type: "text", text: `Zeabur API access verified. Account username: ${username}` }]
      };
    }
  );

  return server;
}

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "zeabur-remote-mcp",
    configured: {
      zeaburToken: Boolean(zeaburToken),
      mcpAccessToken: Boolean(mcpAccessToken)
    }
  });
});

app.all("/mcp", async (req, res) => {
  if (!isAuthorized(req)) {
    res.set("WWW-Authenticate", "Bearer");
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!zeaburToken || !mcpAccessToken) {
    return res.status(503).json({ error: "Required server environment variables are not configured" });
  }

  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return res.status(405).json({ error: "Use POST for this stateless MCP endpoint" });
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  const server = createMcpServer();

  try {
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error instanceof Error ? error.message : "Unknown error");
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP request failed" });
    }
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Zeabur remote MCP listening on port ${port}`);
});
