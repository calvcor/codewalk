#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CodeWalkBackend, createCodeWalkMcpServer } from './mcpCore';
import {
  BridgeHealthResponse,
  StepQuestion,
  Tour,
  TourStep,
} from './types';

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
      `Could not connect to the CodeWalk VS Code extension (${BASE_URL}). ` +
        `Make sure VS Code is open with the CodeWalk extension running. (${detail})`
    );
  }

  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? `Bridge HTTP error ${response.status}`);
  }
  return data;
}

const httpBackend: CodeWalkBackend = {
  getHealth: () => bridgeRequest<BridgeHealthResponse>('GET', '/health'),
  createTour: async (payload) => {
    const result = await bridgeRequest<{ tour: Tour }>('POST', '/tour', payload);
    return result.tour;
  },
  addSteps: async (payload) => {
    const result = await bridgeRequest<{ tour: Tour }>(
      'POST',
      '/tour/steps',
      payload
    );
    return result.tour;
  },
  focusStep: async (payload) => {
    const result = await bridgeRequest<{ step: TourStep }>(
      'POST',
      '/tour/focus',
      payload
    );
    return result.step;
  },
  highlightCode: async (payload) => {
    await bridgeRequest('POST', '/highlight', payload);
  },
  getQuestions: async (includeAnswered) => {
    const query = includeAnswered ? '?all=true' : '';
    const result = await bridgeRequest<{ questions: StepQuestion[] }>(
      'GET',
      `/questions${query}`
    );
    return result.questions;
  },
  reply: async (payload) => {
    const result = await bridgeRequest<{ question: StepQuestion }>(
      'POST',
      '/reply',
      payload
    );
    return result.question;
  },
  clearTour: async () => {
    await bridgeRequest('DELETE', '/tour');
  },
};

const server = createCodeWalkMcpServer(httpBackend, PORT);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[codewalk-mcp] Fatal error:', err);
  process.exit(1);
});
