import * as http from 'http';
import * as vscode from 'vscode';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CodeWalkBackend, createCodeWalkMcpServer } from './mcpCore';
import { TourManager } from './tourManager';
import {
  AddStepsPayload,
  BridgeHealthResponse,
  CodeWalkEvent,
  CreateTourPayload,
  FocusStepPayload,
  HighlightCodePayload,
  ReplyPayload,
} from './types';

export class BridgeServer implements vscode.Disposable {
  private server: http.Server | null = null;
  private port: number;
  private running = false;
  private lastError: string | null = null;

  private readonly waitingListeners = new Set<http.ServerResponse>();
  private readonly eventQueue: CodeWalkEvent[] = [];
  private sessionActive = false;
  private readonly onListenerStateChange?: (listening: boolean) => void;

  constructor(
    private readonly tourManager: TourManager,
    port: number,
    onListenerStateChange?: (listening: boolean) => void
  ) {
    this.port = port;
    this.onListenerStateChange = onListenerStateChange;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public isListening(): boolean {
    return this.waitingListeners.size > 0 || this.sessionActive;
  }

  public getPort(): number {
    return this.port;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Emits an event to any connected /events/next listener.
   * Returns true if delivered immediately or queued for an active listening session.
   */
  public emitEvent(event: CodeWalkEvent): boolean {
    if (event.type === 'stop_listening') {
      this.sessionActive = false;
      this.eventQueue.length = 0;
      const delivered = this.flushToListeners(event);
      this.notifyListenerState();
      return delivered;
    }

    if (this.waitingListeners.size > 0) {
      this.flushToListeners(event);
      return true;
    }

    if (this.sessionActive) {
      this.eventQueue.push(event);
      return true;
    }

    return false;
  }

  public stopListening(): boolean {
    return this.emitEvent({
      type: 'stop_listening',
      createdAt: new Date().toISOString(),
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          if (!res.headersSent) {
            this.sendJson(res, 500, { ok: false, error: message });
          }
        });
      });

      // Disable default HTTP request/headers timeouts so long-polling on /events/next
      // can wait indefinitely with zero polling overhead.
      server.requestTimeout = 0;
      server.headersTimeout = 0;
      server.keepAliveTimeout = 0;

      server.on('error', (err: NodeJS.ErrnoException) => {
        this.running = false;
        this.lastError = err.message;
        if (err.code === 'EADDRINUSE') {
          console.warn(
            `[codewalk] Port ${this.port} is already in use by another instance.`
          );
        } else {
          console.error('[codewalk] Bridge server error:', err);
        }
        resolve();
      });

      server.listen(this.port, '127.0.0.1', () => {
        this.server = server;
        this.running = true;
        this.lastError = null;
        console.log(
          `[codewalk] Local bridge listening on http://127.0.0.1:${this.port}`
        );
        resolve();
      });
    });
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${this.port}`);
    const pathname = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();

    if (pathname === '/mcp') {
      await this.handleMcpRequest(req, res);
      return;
    }

    if (method === 'GET' && pathname === '/health') {
      this.sendJson(res, 200, this.getHealth());
      return;
    }

    if (method === 'GET' && pathname === '/events/next') {
      this.handleNextEvent(req, res);
      return;
    }

    if (method === 'POST' && pathname === '/events/stop') {
      this.stopListening();
      this.sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'GET' && pathname === '/state') {
      this.sendJson(res, 200, {
        ok: true,
        tour: this.tourManager.getTour(),
      });
      return;
    }

    if (method === 'GET' && pathname === '/questions') {
      const includeAll = url.searchParams.get('all') === 'true';
      this.sendJson(res, 200, {
        ok: true,
        questions: this.tourManager.getQuestions(includeAll),
      });
      return;
    }

    if (method === 'POST' && pathname === '/tour') {
      const payload = await this.readJson<CreateTourPayload>(req);
      const tour = await this.tourManager.createTour(payload);
      this.sendJson(res, 200, { ok: true, tour });
      return;
    }

    if (method === 'POST' && pathname === '/tour/steps') {
      const payload = await this.readJson<AddStepsPayload>(req);
      const tour = await this.tourManager.addSteps(payload);
      this.sendJson(res, 200, { ok: true, tour });
      return;
    }

    if (method === 'POST' && pathname === '/tour/focus') {
      const payload = await this.readJson<FocusStepPayload>(req);
      const step = await this.tourManager.focusStep(payload);
      this.sendJson(res, 200, { ok: true, step });
      return;
    }

    if (method === 'POST' && pathname === '/highlight') {
      const payload = await this.readJson<HighlightCodePayload>(req);
      await this.tourManager.highlightCode(payload);
      this.sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && pathname === '/reply') {
      const payload = await this.readJson<ReplyPayload>(req);
      const question = await this.tourManager.replyToStep(payload);
      this.sendJson(res, 200, { ok: true, question });
      return;
    }

    if (method === 'DELETE' && pathname === '/tour') {
      await this.tourManager.clearTour();
      this.sendJson(res, 200, { ok: true });
      return;
    }

    this.sendJson(res, 404, {
      ok: false,
      error: `Route not found: ${method} ${pathname}`,
    });
  }

  private getHealth(): BridgeHealthResponse {
    const tour = this.tourManager.getTour();
    const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map(
      (f) => f.uri.fsPath
    );
    return {
      ok: true,
      version: '0.2.0',
      port: this.port,
      listening: this.isListening(),
      workspaceFolders,
      activeTour: tour
        ? {
            id: tour.id,
            title: tour.title,
            stepCount: tour.steps.length,
            currentStepIndex: tour.currentStepIndex,
            pendingQuestions: tour.questions.filter((q) => !q.answer).length,
          }
        : null,
    };
  }

  private createMcpBackend(): CodeWalkBackend {
    return {
      getHealth: async () => this.getHealth(),
      createTour: (payload) => this.tourManager.createTour(payload),
      addSteps: (payload) => this.tourManager.addSteps(payload),
      focusStep: (payload) => this.tourManager.focusStep(payload),
      highlightCode: (payload) => this.tourManager.highlightCode(payload),
      getQuestions: async (includeAnswered) =>
        this.tourManager.getQuestions(includeAnswered),
      reply: (payload) => this.tourManager.replyToStep(payload),
      clearTour: () => this.tourManager.clearTour(),
    };
  }

  private async handleMcpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const method = (req.method ?? 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = createCodeWalkMcpServer(
      this.createMcpBackend(),
      this.port
    );

    res.on('close', () => {
      void transport.close();
      void mcpServer.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  }

  private handleNextEvent(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    req.setTimeout(0);
    res.setTimeout(0);
    this.sessionActive = true;

    if (this.eventQueue.length > 0) {
      const next = this.eventQueue.shift()!;
      this.notifyListenerState();
      this.sendJson(res, 200, next);
      return;
    }

    this.waitingListeners.add(res);
    this.notifyListenerState();

    req.on('close', () => {
      if (this.waitingListeners.delete(res)) {
        // Client disconnected (e.g., cancelled from Antigravity).
        if (this.waitingListeners.size === 0) {
          this.sessionActive = false;
        }
        this.notifyListenerState();
      }
    });
  }

  private flushToListeners(event: CodeWalkEvent): boolean {
    if (this.waitingListeners.size === 0) {
      return false;
    }
    const listeners = Array.from(this.waitingListeners);
    this.waitingListeners.clear();
    for (const res of listeners) {
      if (!res.writableEnded) {
        this.sendJson(res, 200, event);
      }
    }
    return true;
  }

  private notifyListenerState(): void {
    this.onListenerStateChange?.(this.isListening());
  }

  private readJson<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const maxBytes = 5 * 1024 * 1024;

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          reject(new Error('Request payload too large.'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (!raw) {
          resolve({} as T);
          return;
        }
        try {
          resolve(JSON.parse(raw) as T);
        } catch {
          reject(new Error('Invalid JSON payload.'));
        }
      });

      req.on('error', reject);
    });
  }

  private sendJson(
    res: http.ServerResponse,
    statusCode: number,
    data: unknown
  ): void {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  }

  public dispose(): void {
    this.sessionActive = false;
    this.eventQueue.length = 0;
    for (const res of this.waitingListeners) {
      if (!res.writableEnded) {
        res.end();
      }
    }
    this.waitingListeners.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
      this.running = false;
    }
  }
}
