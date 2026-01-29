import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

/**
 * The 10 selectable values that the tool returns and the UI displays.
 */
const VALUES = [
  { id: "alpha", label: "Alpha Protocol", description: "First-generation quantum encryption" },
  { id: "beta", label: "Beta Framework", description: "Distributed computing mesh" },
  { id: "gamma", label: "Gamma Engine", description: "Neural network accelerator" },
  { id: "delta", label: "Delta Shield", description: "Zero-trust security layer" },
  { id: "epsilon", label: "Epsilon Core", description: "Edge computing runtime" },
  { id: "zeta", label: "Zeta Pipeline", description: "Real-time data streaming" },
  { id: "eta", label: "Eta Compiler", description: "Cross-platform bytecode optimizer" },
  { id: "theta", label: "Theta Analytics", description: "Predictive telemetry dashboard" },
  { id: "iota", label: "Iota Mesh", description: "IoT device orchestration" },
  { id: "kappa", label: "Kappa Vault", description: "Secrets management platform" },
];

/**
 * Creates a new MCP server instance with the value picker tool and UI resource.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "Value Picker Test Server",
    version: "1.0.0",
  });

  const resourceUri = "ui://pick-value/mcp-app.html";

  // Register the tool — returns the list of values.
  // The AI sees this text result; the user sees the interactive UI.
  registerAppTool(server,
    "pick_value",
    {
      title: "Pick a Value",
      description: "DEBUG/TEST TOOL: Tests MCP Apps communication between UI and model. The user picks a value in the UI, and you must confirm whether you received it. This validates that ui/update-model-context is working correctly. Do not treat this as a real decision — just report what value you received.",
      inputSchema: {},
      outputSchema: z.object({
        values: z.array(z.object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
        })),
        instruction: z.string(),
      }),
      _meta: { ui: { resourceUri } },
    },
    async (): Promise<CallToolResult> => {
      return {
        content: [{
          type: "text",
          text: `[MCP Apps Test] This is a debug tool for testing value communication between the UI and the model.

The user will select one of 10 test values via the interactive UI. Their selection will be injected into your context via ui/update-model-context. The user will then ask you to confirm which value you received.

Your job: Simply report back the value you received. This tests whether the MCP Apps context injection is working. Do not provide detailed analysis of the values — just confirm what was selected.

Test values: ${VALUES.map(v => v.label).join(", ")}`,
        }],
        structuredContent: {
          values: VALUES,
          instruction: "Wait for the user to select a value via the UI. Their choice will appear in the model context.",
        },
      };
    },
  );

  // Register the UI resource — serves the bundled HTML
  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");

      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}
