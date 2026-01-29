/**
 * Entry point for running the Value Picker MCP server.
 *
 * Transport selection:
 *   --stdio   Force STDIO mode
 *   --http    Force Streamable HTTP mode
 *   (default) Auto-detect: STDIO when stdin is piped, HTTP when interactive
 *
 * IMPORTANT: In STDIO mode, stdout is reserved for JSON-RPC messages.
 * ALL console output is suppressed to avoid corrupting the protocol.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createNetServer } from "node:net";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

/**
 * Determine transport mode:
 * 1. Explicit --stdio flag → STDIO
 * 2. Explicit --http flag → HTTP
 * 3. Auto-detect: stdin is piped (not a TTY) → STDIO, otherwise HTTP
 */
function resolveTransport(): "stdio" | "http" {
  if (process.argv.includes("--stdio")) return "stdio";
  if (process.argv.includes("--http")) return "http";
  // When a client (Claude Desktop, MCP sandbox) spawns this process,
  // stdin is a pipe, not a TTY.
  return process.stdin.isTTY ? "http" : "stdio";
}

const transport = resolveTransport();

/**
 * In STDIO mode, suppress ALL console output.
 * stdout is reserved for JSON-RPC, and the sandbox may also capture stderr.
 */
if (transport === "stdio") {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
}

/**
 * Find an available port. Tries the preferred port first, then falls back
 * to an OS-assigned ephemeral port.
 */
function findAvailablePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Preferred port is taken — let the OS assign one
        srv.listen(0, "0.0.0.0", () => {
          const addr = srv.address();
          const port = typeof addr === "object" && addr ? addr.port : 0;
          srv.close(() => resolve(port));
        });
      } else {
        reject(err);
      }
    });
    srv.listen(preferred, "0.0.0.0", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : preferred;
      srv.close(() => resolve(port));
    });
  });
}

export async function startStreamableHTTPServer(
  createServer: () => McpServer,
): Promise<void> {
  const preferredPort = parseInt(process.env.PORT ?? "3456", 10);
  const port = await findAvailablePort(preferredPort);

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, (err) => {
    if (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
    console.log(`Value Picker MCP server listening on http://localhost:${port}/mcp`);
  });

  const shutdown = () => {
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export async function startStdioServer(
  createServer: () => McpServer,
): Promise<void> {
  const server = createServer();
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}

async function main() {
  if (transport === "stdio") {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
