/**
 * Value Picker MCP App
 *
 * Tests Phase 5 features:
 * - ui/update-model-context: selected value is sent to model context
 * - ui/message: sends a follow-up user message after selection
 * - app.callServerTool: interactive tool calls from the UI
 */
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import "./mcp-app.css";

interface Value {
  id: string;
  label: string;
  description: string;
}

// DOM references
const mainEl = document.querySelector(".main") as HTMLElement;
const gridEl = document.getElementById("values-grid")!;
const statusEl = document.getElementById("status")!;

// Tracks the currently selected value
let _selectedId: string | null = null;

function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

/**
 * Render the 10 value cards into the grid.
 */
function renderValues(values: Value[]) {
  gridEl.innerHTML = "";

  for (const value of values) {
    const card = document.createElement("button");
    card.className = "value-card";
    card.dataset.id = value.id;
    card.innerHTML = `
      <span class="value-label">${value.label}</span>
      <span class="value-desc">${value.description}</span>
    `;

    card.addEventListener("click", () => handleSelect(value));
    gridEl.appendChild(card);
  }
}

/**
 * Handle value selection.
 * 1. Highlight the selected card
 * 2. Call updateModelContext to inject the selection into model context
 * 3. Call sendMessage to notify the AI of the selection
 */
async function handleSelect(value: Value) {
  // Update UI
  _selectedId = value.id;
  document.querySelectorAll(".value-card").forEach((el) => {
    el.classList.toggle("selected", (el as HTMLElement).dataset.id === value.id);
  });

  console.info(`Selection changed to: ${_selectedId}`);
  statusEl.textContent = `Selected: ${value.label} — sending to AI...`;
  statusEl.className = "status sending";

  try {
    // 1. Update model context so the AI knows the selection
    await app.updateModelContext({
      content: [{
        type: "text",
        text: `The user selected "${value.label}" (id: ${value.id}). Description: ${value.description}. Please acknowledge their selection and provide relevant information about this choice.`,
      }],
    });

    // 2. Send a user message to trigger the AI to respond
    const result = await app.sendMessage({
      role: "user",
      content: [{
        type: "text",
        text: `I have picked a value, can you tell me what it is?`,
      }],
    });

    if (result.isError) {
      statusEl.textContent = `Selected: ${value.label} (context updated, message send was rejected)`;
      statusEl.className = "status warning";
    } else {
      statusEl.textContent = `Selected: ${value.label} — AI has been notified!`;
      statusEl.className = "status success";
    }
  } catch (e) {
    console.error("Failed to send selection:", e);
    statusEl.textContent = `Selected: ${value.label} — failed to notify AI`;
    statusEl.className = "status error";
  }
}

// Create App instance
const app = new App({ name: "Value Picker", version: "1.0.0" });

// Register handlers
app.onteardown = async () => {
  console.info("Value Picker app is being torn down");
  return {};
};

app.ontoolinput = (params) => {
  console.info("Received tool input:", params);
  // Tool input contains arguments — our tool has no input args, so
  // values come from the tool result instead
};

app.ontoolresult = (result) => {
  console.info("Received tool result:", result);
  // Also try to extract values from structured result
  const structured = result.structuredContent as { values?: Value[] } | undefined;
  if (structured?.values) {
    renderValues(structured.values);
  }
};

app.ontoolcancelled = (params) => {
  console.info("Tool call cancelled:", params.reason);
  statusEl.textContent = "Tool call was cancelled";
  statusEl.className = "status warning";
};

app.onerror = (err) => {
  console.error("App error:", err);
};

app.onhostcontextchanged = handleHostContextChanged;

// Connect to host
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});
