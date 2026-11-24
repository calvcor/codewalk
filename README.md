# CodeWalk

A VS Code extension and local MCP server that lets your AI coding agent (such as Antigravity, Claude Code, Cursor, or any MCP client) walk you through large codebases interactively right inside your editor — **without requiring an external LLM API key**.

## Features

- **Spotlight Mode**: Highlights the code block being explained and dims the rest of the file so your focus stays on the relevant logic.
- **Line-by-Line Inline Notes (`lineNotes`)**: Displays concise annotations directly at the end of meaningful lines in the editor, with detailed hover tooltips and an in-depth breakdown for the most important lines in the card below.
- **Inline Explanation Cards (`CommentController`)**: Renders Markdown explanations directly beneath the highlighted block, complete with **Previous / Next** navigation buttons and an inline reply box to ask questions on any step.
- **Sidebar Tour View**: Shows all tour steps, progress, visited state, pending questions, and a **`+`** button to request a new walkthrough.
- **Editor Context Menu (`Explain with CodeWalk`)**: Right-click any file or code selection to request an interactive explanation directly from VS Code.
- **Hybrid Mode + Active Listening (zero idle token usage)**:
  - **Manual mode**: Navigate at your own pace with zero timeouts. Asking a question or requesting a tour copies a ready-to-paste prompt with exact file/line context.
  - **Active listening mode**: Your agent can long-poll `GET http://127.0.0.1:47321/events/next` to receive inline questions and tour requests immediately and reply directly inside VS Code — with a one-click **Stop Listening** button in the status bar and sidebar.

## Build from Source

```bash
npm install
npm run build
```

## 1. Run or Install the VS Code Extension

### Option A — Development Mode (F5)
1. Open the repository folder in VS Code.
2. Press **F5** (`Run CodeWalk Extension`) or select **`Run > Run Without Debugging`**.
3. Open the project you want to explore in the newly launched VS Code window.

### Option B — Package and Install Permanently (`.vsix`)
```bash
npx @vscode/vsce package
code --install-extension codewalk-0.2.0.vsix
```

On startup, the extension starts a localhost-only MCP & HTTP bridge at `http://127.0.0.1:47321` (configurable via `codewalk.port`), exposing the Streamable HTTP MCP endpoint at **`http://127.0.0.1:47321/mcp`**. You can check its status at any time with **`CodeWalk: Show MCP Bridge Status`**.

## 2. Connect Your MCP Client

Add `codewalk` to your MCP client configuration (for Antigravity: `~/.gemini/config/mcp_config.json`):

### Recommended — Streamable HTTP (no repo clone required)

Because the MCP server runs directly inside the VS Code extension, any MCP client that supports Streamable HTTP (Antigravity, Cursor, Claude Code, VS Code, etc.) only needs the local URL:

```json
{
  "mcpServers": {
    "codewalk": {
      "url": "http://127.0.0.1:47321/mcp"
    }
  }
}
```

### Fallback — Stdio (for stdio-only clients)

If your MCP client only supports `stdio`, you can point it at the bundled `dist/mcpServer.js` bridge:

```json
{
  "mcpServers": {
    "codewalk": {
      "command": "node",
      "args": ["/path/to/codewalk/dist/mcpServer.js"],
      "env": {
        "CODEWALK_PORT": "47321"
      }
    }
  }
}
```

> If you already have other servers configured under `mcpServers`, add only the `"codewalk": { ... }` entry.

## 3. Usage

1. Open your project in VS Code with the **CodeWalk** extension active.
2. Ask your AI agent:
   > *"Walk me through the authentication flow in this project using CodeWalk"*
3. Your agent calls `codewalk_create_tour`, and VS Code automatically opens the first step with spotlight highlighting, inline line notes, and the explanation card.
4. Navigate using the inline card buttons, the **CodeWalk** sidebar, or **`Alt+Right`** / **`Alt+Left`**.
5. To ask a question about any step, type it into the inline reply box and click **Ask Question**.

## Available MCP Tools

| Tool | Description |
| --- | --- |
| `codewalk_status` | Check VS Code bridge connection, open workspace folders, active tour status, and pending questions |
| `codewalk_create_tour` | Create a step-by-step walkthrough with inline `lineNotes` and focus the first step in VS Code |
| `codewalk_add_steps` | Append additional steps to the active tour |
| `codewalk_focus_step` | Jump VS Code to a specific step by 0-based index or `stepId` |
| `codewalk_highlight_code` | Highlight a code range with a standalone inline note without replacing the active tour |
| `codewalk_get_questions` | Retrieve pending (or all) user questions submitted inline in VS Code |
| `codewalk_reply` | Post an answer directly into the inline comment thread of a step in VS Code |
| `codewalk_clear_tour` | Clear spotlight highlights, inline cards, and end the active tour |

## Extension Settings

| Setting | Default | Description |
| --- | --- | --- |
| `codewalk.port` | `47321` | Localhost port for the CodeWalk MCP bridge server |
| `codewalk.dimInactiveCode` | `true` | Dim lines outside the currently explained code block |
| `codewalk.showLineNotes` | `true` | Show concise inline explanations at the end of key lines |
| `codewalk.copyQuestionPrompt` | `true` | Copy a ready-to-paste prompt to the clipboard when asking a question in manual mode |
| `codewalk.language` | `"auto"` | UI language (`"auto"`, `"en"`, `"es"`). Defaults to English and automatically switches when Spanish is detected in questions or tours |

## License

[MIT](LICENSE)
