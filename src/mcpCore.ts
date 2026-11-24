import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  AddStepsPayload,
  BridgeHealthResponse,
  CreateTourPayload,
  FocusStepPayload,
  HighlightCodePayload,
  ReplyPayload,
  StepQuestion,
  Tour,
  TourStep,
} from './types';

export interface CodeWalkBackend {
  getHealth(): Promise<BridgeHealthResponse>;
  createTour(payload: CreateTourPayload): Promise<Tour>;
  addSteps(payload: AddStepsPayload): Promise<Tour>;
  focusStep(payload: FocusStepPayload): Promise<TourStep>;
  highlightCode(payload: HighlightCodePayload): Promise<void>;
  getQuestions(includeAnswered: boolean): Promise<StepQuestion[]>;
  reply(payload: ReplyPayload): Promise<StepQuestion | null>;
  clearTour(): Promise<void>;
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
      description:
        '1-based start line of the code block to explain (keep blocks focused)',
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

export function createCodeWalkMcpServer(
  backend: CodeWalkBackend,
  port: number
): Server {
  const baseUrl = `http://127.0.0.1:${port}`;
  const eventsUrl = `${baseUrl}/events/next`;
  const listenCommand = `curl -sS --max-time 0 ${eventsUrl}`;

  const instructions = `CodeWalk runs inside VS Code at ${baseUrl}.

## Active Listening Mode (Zero Idle Tokens)
When the user asks you to keep listening / stay listening for CodeWalk questions or tour requests:
- NEVER use timers, cron schedules, sleep loops, or periodic polling of \`codewalk_get_questions\` (every wakeup wastes tokens).
- Instead, run this single long-polling command in the background (with no notification timeout) and end your turn so you consume 0 tokens while waiting:
  \`${listenCommand}\`
- The bridge holds the HTTP connection open with zero overhead until an event happens in VS Code, then returns a single JSON object and exits, automatically waking you:
  - \`{"type":"question","question":{...}}\`: Reply inline with \`codewalk_reply\` (passing \`questionId\` and \`stepId\`), then start the background \`curl\` again to continue listening.
  - \`{"type":"tour_request",...}\`: Build the walkthrough with \`codewalk_create_tour\`, then start the background \`curl\` again.
  - \`{"type":"stop_listening",...}\`: The user clicked "Stop Listening" in VS Code — stop listening and do NOT restart \`curl\`.
- If the user asks you in chat to stop listening, cancel the background \`curl\` task (or POST \`${baseUrl}/events/stop\`).`;

  const tools: Tool[] = [
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
            description:
              'Title of the walkthrough (e.g., "Authentication Flow")',
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
      description: `One-shot read of questions the user submitted inline on tour steps in VS Code. NEVER poll this tool on a timer or schedule to keep listening (that wastes tokens). For zero-token active listening, run \`${listenCommand}\` as a background shell command (no notification timeout) and end your turn until it completes with a JSON event.`,
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
      description: `Post an answer directly into the inline comment thread of a tour step in VS Code, resolving the user question. If the user asked you to stay listening afterwards, do NOT set a timer or poll \`codewalk_get_questions\` — instead run \`${listenCommand}\` in the background (no notification timeout) and end your turn.`,
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
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions,
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'codewalk_status': {
          const health = await backend.getHealth();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    ...health,
                    mcpUrl: `${baseUrl}/mcp`,
                    eventsUrl,
                    listenCommand,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'codewalk_create_tour': {
          const tour = await backend.createTour(
            args as unknown as CreateTourPayload
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    message: `Tour "${tour.title}" created with ${tour.steps.length} steps and opened in VS Code.`,
                    tourId: tour.id,
                    steps: tour.steps.map((s, i) => ({
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
          const payload = args as unknown as AddStepsPayload;
          const addedCount = Array.isArray(payload.steps)
            ? payload.steps.length
            : 0;
          const tour = await backend.addSteps(payload);
          return {
            content: [
              {
                type: 'text',
                text: `Added ${addedCount} step(s) to "${tour.title}". Total steps: ${tour.steps.length}.`,
              },
            ],
          };
        }

        case 'codewalk_focus_step': {
          const step = await backend.focusStep(
            args as unknown as FocusStepPayload
          );
          return {
            content: [
              {
                type: 'text',
                text: `Focused step "${step.title}" (${step.file}:${step.startLine}-${step.endLine}).`,
              },
            ],
          };
        }

        case 'codewalk_highlight_code': {
          const payload = args as unknown as HighlightCodePayload;
          await backend.highlightCode(payload);
          const file = String(payload.file ?? '');
          const startLine = Number(payload.startLine ?? 1);
          const endLine = Number(payload.endLine ?? startLine);
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
          const questions = await backend.getQuestions(
            Boolean(args.includeAnswered)
          );
          return {
            content: [
              { type: 'text', text: JSON.stringify(questions, null, 2) },
            ],
          };
        }

        case 'codewalk_reply': {
          const question = await backend.reply(
            args as unknown as ReplyPayload
          );
          return {
            content: [
              {
                type: 'text',
                text: question
                  ? `Reply posted to step "${question.stepTitle}" (questionId: ${question.id}).`
                  : 'Reply posted in VS Code.',
              },
            ],
          };
        }

        case 'codewalk_clear_tour': {
          await backend.clearTour();
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

  return server;
}
