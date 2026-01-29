# Value Picker Server

A debug tool for **platform developers** building MCP Apps hosts. Use this MCP server to verify that your platform correctly implements the `ui/update-model-context` and `ui/message` protocols defined in the [MCP Apps Specification](https://github.com/modelcontextprotocol/ext-apps/tree/main/specification).

## Why Use This?

When building an MCP Apps host, you need to verify that:

1. **Context injection works** — Values selected in the UI iframe reach the AI model via `ui/update-model-context`
2. **Message sending works** — The UI can trigger follow-up messages via `ui/message`
3. **The complete flow works** — View → Host → Model communication is functioning end-to-end

This tool provides a simple "blind selection" test: the user picks a value in the UI, and the AI must correctly identify what was selected. If the AI knows the value, your platform is working. If not, something is broken in your `ui/update-model-context` implementation.

---

## Installation

### Via npm (Recommended)

Install from [npmjs.com/package/mcp-server-value-picker](https://www.npmjs.com/package/mcp-server-value-picker):

```bash
npm install -g mcp-server-value-picker
```

Run the server:

```bash
# Auto-detects transport mode
mcp-server-value-picker

# Force STDIO mode (for Claude Desktop)
mcp-server-value-picker --stdio

# Force HTTP mode
mcp-server-value-picker --http
```

Or run directly with npx (no install required):

```bash
npx mcp-server-value-picker
```

### Local Development

For modifying the example or contributing:

```bash
npm install
npm run build
npm start
```

Default HTTP endpoint: `http://localhost:3456/mcp`

---

## How the Test Works

1. Connect this MCP server to your platform
2. The AI calls the `pick_value` tool, which displays 10 selectable values in the UI
3. User clicks a value card
4. The UI sends `ui/update-model-context` with the selection details
5. The UI sends `ui/message` asking "I have picked a value, can you tell me what it is?"
6. **If your platform works**: The AI responds with the correct value
7. **If something is broken**: The AI won't know what was selected

### Expected Model Response

The tool description explicitly tells the AI this is a debug test. A correct response looks like:

> "You selected **Alpha Protocol** (id: alpha)."

If the AI elaborates extensively on the value meanings, the test still passed (context injection worked), but the AI didn't follow the debug instructions.

---

## What This Tests

### Platform Requirements Verified

| Your Platform Must...               | Protocol Message                 | Verified By                  |
| ----------------------------------- | -------------------------------- | ---------------------------- |
| Inject UI context into model        | `ui/update-model-context`      | AI knows selected value      |
| Forward UI messages to conversation | `ui/message`                   | AI receives follow-up prompt |
| Deliver tool results to UI          | `ui/notifications/tool-result` | UI renders value cards       |
| Pass tool arguments to UI           | `ui/notifications/tool-input`  | UI receives empty args       |
| Handle teardown gracefully          | `ui/resource-teardown`         | No errors on close           |

### Full Specification Coverage

[Full Specification](https://github.com/modelcontextprotocol/ext-apps/tree/main/specification)

| Feature                                              | Spec Section         |
| ---------------------------------------------------- | -------------------- |
| `text/html;profile=mcp-app` MIME type              | UI Resource Format   |
| `ui://` URI scheme                                 | UI Resource Format   |
| `_meta.ui.resourceUri` linkage                     | Resource Discovery   |
| `ui/initialize` / `ui/notifications/initialized` | Lifecycle            |
| `ui/notifications/tool-input`                      | Data Passing         |
| `ui/notifications/tool-result`                     | Data Passing         |
| `ui/notifications/tool-cancelled`                  | Notifications        |
| `ui/resource-teardown`                             | Cleanup              |
| `ui/update-model-context`                          | Requests             |
| `ui/message`                                       | Requests             |
| `ui/notifications/host-context-changed`            | Notifications        |
| `HostContext.theme`                                | Theming              |
| `HostContext.styles.variables`                     | Theming              |
| `HostContext.styles.css.fonts`                     | Custom Fonts         |
| `HostContext.safeAreaInsets`                       | Container Dimensions |
| `content` + `structuredContent` dual model       | Data Passing         |

---

## Files

| File                | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `server.ts`       | MCP server with `pick_value` tool and UI resource    |
| `src/mcp-app.ts`  | View implementation (`App` class, handlers, context) |
| `src/mcp-app.css` | View styling with CSS variable fallbacks               |
| `mcp-app.html`    | HTML template with color-scheme meta tag               |
| `main.ts`         | Entry point with STDIO/HTTP transport selection        |

---

## Implementation Details

<details>
<summary>Server-side implementation</summary>

### Tool Registration with UI Metadata

```typescript
registerAppTool(server, "pick_value", {
  title: "Pick a Value",
  description: "DEBUG/TEST TOOL: Tests MCP Apps communication between UI and model...",
  inputSchema: {},
  _meta: { ui: { resourceUri: "ui://pick-value/mcp-app.html" } },
}, async () => { /* handler */ });
```

### Dual Content Model

```typescript
return {
  content: [{
    type: "text",
    text: `[MCP Apps Test] This is a debug tool...`,
  }],
  structuredContent: {
    values: VALUES,  // UI-only, not sent to model
  },
};
```

</details>

<details>
<summary>View-side implementation</summary>

### Context Update

```typescript
await app.updateModelContext({
  content: [{
    type: "text",
    text: `The user selected "${value.label}" (id: ${value.id}).`,
  }],
});
```

### Message Sending

```typescript
await app.sendMessage({
  role: "user",
  content: [{
    type: "text",
    text: `I have picked a value, can you tell me what it is?`,
  }],
});
```

### Host Context Handling

```typescript
app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) { /* apply padding */ }
};
```

</details>
