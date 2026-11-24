#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

const PORT = Number(process.env.CODEWALK_PORT ?? '47321');
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function bridgeRequest<T>(
  method: string,
  pathname: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${pathname}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers:
        body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `No se pudo conectar con la extensión CodeWalk en VS Code (${BASE_URL}). ` +
        `Asegúrate de tener VS Code abierto con la extensión codewalk activa. (${detail})`
    );
  }

  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? `Bridge HTTP error ${response.status}`);
  }
  return data;
}

const lineNoteSchema = {
  type: 'object',
  properties: {
    line: {
      type: 'integer',
      minimum: 1,
      description: '1-based line number inside the highlighted block',
    },
    text: {
      type: 'string',
      description:
        'Concise inline annotation rendered right at the end of that line (aim for <= 75 chars)',
    },
    important: {
      type: 'boolean',
      description:
        'Set to true for the most important lines in the step so they are also explained in depth in the card below; leave false/omitted for regular inline-only notes',
    },
    detail: {
      type: 'string',
      description:
        'In-depth Markdown explanation shown in the card below (and on hover) for important lines: explain the "why", data flow, side effects, edge cases, or how it connects to the rest of the codebase (implies important)',
    },
  },
  required: ['line', 'text'],
};

const tourStepSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Optional stable step ID (e.g., "auth-middleware")',
    },
    title: {
      type: 'string',
      description: 'Short step title shown in the sidebar and inline card header',
    },
    file: {
      type: 'string',
      description: 'Absolute path or workspace-relative path to the file',
    },
    startLine: {
      type: 'integer',
      minimum: 1,
      description: '1-based start line of the code block to explain (keep blocks focused)',
    },
    endLine: {
      type: 'integer',
      minimum: 1,
      description: '1-based end line (defaults to startLine)',
    },
    explanation: {
      type: 'string',
      description:
        'Concise high-level Markdown explanation of the block shown in the inline card',
    },
    lineNotes: {
      type: 'array',
      items: lineNoteSchema,
      description:
        'Be thorough: add concise inline lineNotes covering almost every meaningful line in the highlighted block (declarations, calls, branches, returns, side effects). For the most important lines (as many as needed, no fixed cap), set `important: true` and provide a deep `detail` explaining why it works that way and how it fits into the broader flow so it is explained in depth in the card below.',
    },
  },
  required: ['title', 'file', 'startLine', 'explanation'],
};

const TOOLS: Tool[] = [
  {
    name: 'codewalk_status',
    description:
      'Check connection to the CodeWalk VS Code extension, open workspace folders, active tour status, and pending user questions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'codewalk_create_tour',
    description:
      'Create an interactive step-by-step code walkthrough in VS Code. Make each important code block its own step (even within the same file), keep ranges focused, and provide thorough inline `lineNotes` for almost all meaningful lines of each block — giving the most important lines `important: true` plus an in-depth `detail` rendered in the card below.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the walkthrough (e.g., "Authentication Flow")',
        },
        summary: {
          type: 'string',
          description: 'Optional high-level summary of the tour',
        },
        steps: {
          type: 'array',
          minItems: 1,
          items: tourStepSchema,
          description: 'Ordered list of walkthrough steps',
        },
        startIndex: {
          type: 'integer',
          minimum: 0,
          description: '0-based step index to focus first (default 0)',
        },
      },
      required: ['title', 'steps'],
    },
  },
  {
    name: 'codewalk_add_steps',
    description:
      'Append additional steps to the currently active CodeWalk tour in VS Code.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          minItems: 1,
          items: tourStepSchema,
          description: 'Additional steps to append',
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'codewalk_focus_step',
    description:
      'Jump VS Code to a specific step in the active tour by 0-based index or stepId.',
    inputSchema: {
      type: 'object',
      properties: {
        index: {
          type: 'integer',
          minimum: 0,
          description: '0-based step index',
        },
        stepId: {
          type: 'string',
          description: 'Step ID',
        },
      },
    },
  },
  {
    name: 'codewalk_highlight_code',
    description:
      'Highlight a specific code range in VS Code with a standalone inline explanation note without replacing the active tour.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Absolute or workspace-relative file path',
        },
        startLine: {
          type: 'integer',
          minimum: 1,
          description: '1-based start line',
        },
        endLine: {
          type: 'integer',
          minimum: 1,
          description: '1-based end line',
        },
        title: {
          type: 'string',
          description: 'Card title',
        },
        explanation: {
          type: 'string',
          description: 'Markdown explanation to display inline',
        },
        lineNotes: {
          type: 'array',
          items: lineNoteSchema,
          description:
            'Optional line-by-line annotations rendered directly at the end of key lines',
        },
      },
      required: ['file', 'startLine', 'explanation'],
    },
  },
  {
    name: 'codewalk_get_questions',
    description:
      'Read questions the user submitted inline on tour steps in VS Code.',
    inputSchema: {
      type: 'object',
      properties: {
        includeAnswered: {
          type: 'boolean',
          description:
            'If true, return all questions including already answered ones (default false)',
        },
      },
    },
  },
  {
    name: 'codewalk_reply',
    description:
      'Post an answer directly into the inline comment thread of a tour step in VS Code, resolving the user question.',
    inputSchema: {
      type: 'object',
      properties: {
        answer: {
          type: 'string',
          description: 'Markdown answer to display in the inline thread',
        },
        questionId: {
          type: 'string',
          description: 'Specific question ID from codewalk_get_questions',
        },
        stepId: {
          type: 'string',
          description: 'Step ID to attach the reply to',
        },
        focusStep: {
          type: 'boolean',
          description: 'Whether to focus the step in VS Code (default true)',
        },
      },
      required: ['answer'],
    },
  },
  {
    name: 'codewalk_clear_tour',
    description:
      'End the active CodeWalk tour and clear all spotlight highlights and inline cards in VS Code.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

const server = new Server(
  {
    name: 'codewalk',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'codewalk_status': {
        const health = await bridgeRequest<Record<string, unknown>>(
          'GET',
          '/health'
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(health, null, 2) }],
        };
      }

      case 'codewalk_create_tour': {
        const result = await bridgeRequest<{
          tour: {
            id: string;
            title: string;
            steps: Array<{ id: string; title: string }>;
          };
        }>('POST', '/tour', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: `Tour "${result.tour.title}" created with ${result.tour.steps.length} steps and opened in VS Code.`,
                  tourId: result.tour.id,
                  steps: result.tour.steps.map((s, i) => ({
                    index: i,
                    id: s.id,
                    title: s.title,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'codewalk_add_steps': {
        const steps = Array.isArray(args.steps) ? args.steps : [];
        const result = await bridgeRequest<{
          tour: { title: string; steps: Array<{ id: string; title: string }> };
        }>('POST', '/tour/steps', args);
        return {
          content: [
            {
              type: 'text',
              text: `Added ${steps.length} step(s) to "${result.tour.title}". Total steps: ${result.tour.steps.length}.`,
            },
          ],
        };
      }

      case 'codewalk_focus_step': {
        const result = await bridgeRequest<{
          step: {
            id: string;
            title: string;
            file: string;
            startLine: number;
            endLine: number;
          };
        }>('POST', '/tour/focus', args);
        return {
          content: [
            {
              type: 'text',
              text: `Focused step "${result.step.title}" (${result.step.file}:${result.step.startLine}-${result.step.endLine}).`,
            },
          ],
        };
      }

      case 'codewalk_highlight_code': {
        await bridgeRequest('POST', '/highlight', args);
        const file = String(args.file ?? '');
        const startLine = Number(args.startLine ?? 1);
        const endLine = Number(args.endLine ?? startLine);
        return {
          content: [
            {
              type: 'text',
              text: `Highlighted ${file}:${startLine}-${endLine} in VS Code.`,
            },
          ],
        };
      }

      case 'codewalk_get_questions': {
        const query = args.includeAnswered ? '?all=true' : '';
        const result = await bridgeRequest<{ questions: unknown[] }>(
          'GET',
          `/questions${query}`
        );
        return {
          content: [
            { type: 'text', text: JSON.stringify(result.questions, null, 2) },
          ],
        };
      }

      case 'codewalk_reply': {
        const result = await bridgeRequest<{
          question: { id: string; stepId: string; stepTitle: string };
        }>('POST', '/reply', args);
        return {
          content: [
            {
              type: 'text',
              text: `Reply posted to step "${result.question.stepTitle}" (questionId: ${result.question.id}).`,
            },
          ],
        };
      }

      case 'codewalk_clear_tour': {
        await bridgeRequest('DELETE', '/tour');
        return {
          content: [
            { type: 'text', text: 'CodeWalk tour cleared in VS Code.' },
          ],
        };
      }

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[codewalk-mcp] Fatal error:', err);
  process.exit(1);
});
