import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CommentViewManager } from './commentView';
import { SpotlightManager } from './spotlight';
import { TourTreeDataProvider } from './treeView';
import {
  AddStepsPayload,
  CodeWalkEvent,
  CreateTourPayload,
  FocusStepPayload,
  HighlightCodePayload,
  ReplyPayload,
  StepQuestion,
  Tour,
  TourRequestEvent,
  TourStep,
  TourStepInput,
} from './types';

export class TourManager implements vscode.Disposable {
  private tour: Tour | null = null;
  private readonly spotlight: SpotlightManager;
  private readonly comments: CommentViewManager;
  private readonly treeProvider: TourTreeDataProvider;
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];
  private eventDispatcher: ((event: CodeWalkEvent) => boolean) | null = null;

  constructor(
    spotlight: SpotlightManager,
    comments: CommentViewManager,
    treeProvider: TourTreeDataProvider
  ) {
    this.spotlight = spotlight;
    this.comments = comments;
    this.treeProvider = treeProvider;

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'codewalk.nextStep';
    this.disposables.push(this.statusBarItem);

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.spotlight.reapplyToVisibleEditors();
      })
    );
  }

  public setEventDispatcher(
    dispatcher: (event: CodeWalkEvent) => boolean
  ): void {
    this.eventDispatcher = dispatcher;
  }

  public getTour(): Tour | null {
    return this.tour;
  }

  public getQuestions(includeAnswered = false): StepQuestion[] {
    if (!this.tour) {
      return [];
    }
    return includeAnswered
      ? [...this.tour.questions]
      : this.tour.questions.filter((q) => !q.answer);
  }

  public async createTour(payload: CreateTourPayload): Promise<Tour> {
    if (!payload.steps || payload.steps.length === 0) {
      throw new Error('A tour must contain at least one step.');
    }

    const steps = payload.steps.map((s, idx) => this.normalizeStep(s, idx));
    const startIndex = Math.max(
      0,
      Math.min(steps.length - 1, payload.startIndex ?? 0)
    );

    this.tour = {
      id: `tour-${Date.now()}`,
      title: payload.title,
      summary: payload.summary,
      steps,
      currentStepIndex: startIndex,
      visitedStepIds: [],
      questions: [],
      createdAt: new Date().toISOString(),
    };

    await this.syncContext();
    await this.focusStep({ index: startIndex });
    return this.tour;
  }

  public async addSteps(payload: AddStepsPayload): Promise<Tour> {
    if (!this.tour) {
      throw new Error('No active tour. Create a tour first.');
    }
    if (!payload.steps || payload.steps.length === 0) {
      return this.tour;
    }

    const baseIndex = this.tour.steps.length;
    const added = payload.steps.map((s, idx) =>
      this.normalizeStep(s, baseIndex + idx)
    );
    this.tour.steps.push(...added);
    this.refreshUI();
    return this.tour;
  }

  public async focusStep(payload: FocusStepPayload): Promise<TourStep> {
    if (!this.tour) {
      throw new Error('No active tour.');
    }

    let targetIndex = this.tour.currentStepIndex;
    if (typeof payload.index === 'number') {
      targetIndex = payload.index;
    } else if (payload.stepId) {
      const found = this.tour.steps.findIndex((s) => s.id === payload.stepId);
      if (found === -1) {
        throw new Error(`Step not found: ${payload.stepId}`);
      }
      targetIndex = found;
    }

    if (targetIndex < 0 || targetIndex >= this.tour.steps.length) {
      throw new Error(
        `Step index out of bounds: ${targetIndex} (tour has ${this.tour.steps.length} steps)`
      );
    }

    this.tour.currentStepIndex = targetIndex;
    const step = this.tour.steps[targetIndex];
    if (!this.tour.visitedStepIds.includes(step.id)) {
      this.tour.visitedStepIds.push(step.id);
    }

    const editor = await this.openAndReveal(
      step.file,
      step.startLine,
      step.endLine
    );
    this.spotlight.apply(
      editor,
      step.startLine,
      step.endLine,
      step.lineNotes
    );

    const stepQuestions = this.tour.questions.filter(
      (q) => q.stepId === step.id
    );
    this.comments.showStep(
      editor.document.uri,
      step,
      targetIndex,
      this.tour.steps.length,
      stepQuestions
    );

    this.refreshUI();
    return step;
  }

  public async nextStep(): Promise<void> {
    if (!this.tour) {
      return;
    }
    if (this.tour.currentStepIndex < this.tour.steps.length - 1) {
      await this.focusStep({ index: this.tour.currentStepIndex + 1 });
    } else {
      vscode.window.showInformationMessage(
        `CodeWalk: Has llegado al último paso de "${this.tour.title}".`
      );
    }
  }

  public async prevStep(): Promise<void> {
    if (!this.tour) {
      return;
    }
    if (this.tour.currentStepIndex > 0) {
      await this.focusStep({ index: this.tour.currentStepIndex - 1 });
    } else {
      vscode.window.showInformationMessage(
        'CodeWalk: Ya estás en el primer paso.'
      );
    }
  }

  public async highlightCode(payload: HighlightCodePayload): Promise<void> {
    const endLine = Math.max(
      payload.startLine,
      payload.endLine ?? payload.startLine
    );
    const editor = await this.openAndReveal(
      payload.file,
      payload.startLine,
      endLine
    );
    this.spotlight.apply(
      editor,
      payload.startLine,
      endLine,
      payload.lineNotes ?? []
    );
    this.comments.showQuickHighlight(
      editor.document.uri,
      payload.title ?? path.basename(payload.file),
      payload.startLine,
      endLine,
      payload.explanation
    );
  }

  public async submitQuestion(text: string): Promise<StepQuestion | null> {
    const trimmed = text.trim();
    if (!this.tour || !trimmed) {
      return null;
    }

    const activeStepId = this.comments.getActiveStepId();
    const stepIndex = activeStepId
      ? this.tour.steps.findIndex((s) => s.id === activeStepId)
      : this.tour.currentStepIndex;

    const step = this.tour.steps[stepIndex >= 0 ? stepIndex : this.tour.currentStepIndex];
    if (!step) {
      return null;
    }

    const question: StepQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stepId: step.id,
      stepIndex: stepIndex >= 0 ? stepIndex : this.tour.currentStepIndex,
      stepTitle: step.title,
      file: step.file,
      startLine: step.startLine,
      endLine: step.endLine,
      question: trimmed,
      createdAt: new Date().toISOString(),
    };

    this.tour.questions.push(question);

    const stepQuestions = this.tour.questions.filter(
      (q) => q.stepId === step.id
    );
    this.comments.refreshStepComments(step, stepQuestions);
    this.refreshUI();

    const delivered = this.eventDispatcher?.({
      type: 'question',
      question,
    });

    if (delivered) {
      vscode.window.setStatusBarMessage(
        '$(sync~spin) CodeWalk: Pregunta enviada a Antigravity...',
        5000
      );
      return question;
    }

    const copyPrompt = vscode.workspace
      .getConfiguration('codewalk')
      .get<boolean>('copyQuestionPrompt', true);
    const prompt = this.buildQuestionPrompt(question);

    if (copyPrompt) {
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage(
        'CodeWalk: Pregunta guardada y prompt copiado al portapapeles. Pégalo en Antigravity para que responda aquí.'
      );
    } else {
      const action = await vscode.window.showInformationMessage(
        'CodeWalk: Pregunta guardada para Antigravity.',
        'Copiar prompt'
      );
      if (action === 'Copiar prompt') {
        await vscode.env.clipboard.writeText(prompt);
      }
    }

    return question;
  }

  public async requestTour(
    prompt: string,
    context?: {
      file?: string;
      startLine?: number;
      endLine?: number;
      selectedCode?: string;
    }
  ): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }

    const event: TourRequestEvent = {
      type: 'tour_request',
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: trimmed,
      file: context?.file,
      startLine: context?.startLine,
      endLine: context?.endLine,
      selectedCode: context?.selectedCode,
      createdAt: new Date().toISOString(),
    };

    const delivered = this.eventDispatcher?.(event);
    if (delivered) {
      vscode.window.setStatusBarMessage(
        '$(sync~spin) CodeWalk: Petición de tour enviada a Antigravity...',
        6000
      );
      return;
    }

    const locationPart = context?.file
      ? context.startLine
        ? ` (contexto: ${context.file}:${context.startLine}-${context.endLine ?? context.startLine})`
        : ` (contexto: ${context.file})`
      : '';
    const clipboardPrompt = `[codewalk] Crea un recorrido interactivo con codewalk_create_tour (incluyendo lineNotes): ${trimmed}${locationPart}`;
    await vscode.env.clipboard.writeText(clipboardPrompt);
    vscode.window.showInformationMessage(
      'CodeWalk (modo manual): Prompt copiado al portapapeles. Pégalo en Antigravity (o activa el modo escucha).'
    );
  }

  public async replyToStep(payload: ReplyPayload): Promise<StepQuestion | null> {
    if (!this.tour) {
      throw new Error('No active tour.');
    }

    let targetQuestion: StepQuestion | undefined;
    if (payload.questionId) {
      targetQuestion = this.tour.questions.find(
        (q) => q.id === payload.questionId
      );
    } else if (payload.stepId) {
      targetQuestion = [...this.tour.questions]
        .reverse()
        .find((q) => q.stepId === payload.stepId && !q.answer);
    } else {
      targetQuestion = this.tour.questions.find((q) => !q.answer);
    }

    const targetStepId =
      payload.stepId ??
      targetQuestion?.stepId ??
      this.tour.steps[this.tour.currentStepIndex]?.id;

    const stepIndex = this.tour.steps.findIndex((s) => s.id === targetStepId);
    if (stepIndex === -1) {
      throw new Error(`Step not found for reply: ${targetStepId}`);
    }
    const step = this.tour.steps[stepIndex];

    if (targetQuestion) {
      targetQuestion.answer = payload.answer;
      targetQuestion.answeredAt = new Date().toISOString();
    } else {
      const synthetic: StepQuestion = {
        id: `note-${Date.now()}`,
        stepId: step.id,
        stepIndex,
        stepTitle: step.title,
        file: step.file,
        startLine: step.startLine,
        endLine: step.endLine,
        question: '(Nota adicional)',
        answer: payload.answer,
        createdAt: new Date().toISOString(),
        answeredAt: new Date().toISOString(),
      };
      this.tour.questions.push(synthetic);
      targetQuestion = synthetic;
    }

    if (payload.focusStep !== false && this.comments.getActiveStepId() !== step.id) {
      await this.focusStep({ index: stepIndex });
    } else {
      const stepQuestions = this.tour.questions.filter(
        (q) => q.stepId === step.id
      );
      this.comments.refreshStepComments(step, stepQuestions);
      this.refreshUI();
    }

    return targetQuestion;
  }

  public async clearTour(): Promise<void> {
    this.tour = null;
    this.spotlight.clear();
    this.comments.clear();
    await this.syncContext();
    this.refreshUI();
  }

  public buildPendingQuestionsPrompt(): string | null {
    const pending = this.getQuestions(false);
    if (pending.length === 0) {
      return null;
    }
    if (pending.length === 1) {
      return this.buildQuestionPrompt(pending[0]);
    }
    return `[codewalk] Tengo ${pending.length} preguntas pendientes en el recorrido "${this.tour?.title}". Usa codewalk_get_questions para leerlas y respóndelas con codewalk_reply.`;
  }

  private buildQuestionPrompt(q: StepQuestion): string {
    const lineRef =
      q.startLine === q.endLine
        ? `${q.startLine}`
        : `${q.startLine}-${q.endLine}`;
    return `[codewalk] Pregunta en paso ${q.stepIndex + 1} ("${q.stepTitle}", ${path.basename(q.file)}:${lineRef}): "${q.question}" — Respóndela usando codewalk_reply (questionId: "${q.id}").`;
  }

  private normalizeStep(input: TourStepInput, index: number): TourStep {
    const startLine = Math.max(1, Math.floor(input.startLine));
    const endLine = Math.max(
      startLine,
      Math.floor(input.endLine ?? input.startLine)
    );
    return {
      id: input.id?.trim() || `step-${index + 1}`,
      title: input.title,
      file: input.file,
      startLine,
      endLine,
      explanation: input.explanation,
      lineNotes: (input.lineNotes ?? [])
        .map((n) => ({
          line: Math.max(1, Math.floor(n.line)),
          text: n.text.trim(),
          detail: n.detail?.trim() || undefined,
          important: Boolean(n.important),
        }))
        .filter((n) => n.text.length > 0)
        .sort((a, b) => a.line - b.line),
    };
  }

  private resolveFileUri(filePath: string): vscode.Uri {
    if (path.isAbsolute(filePath)) {
      return vscode.Uri.file(filePath);
    }

    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const candidate = path.join(folder.uri.fsPath, filePath);
      if (fs.existsSync(candidate)) {
        return vscode.Uri.file(candidate);
      }
    }

    if (folders.length > 0) {
      return vscode.Uri.file(path.join(folders[0].uri.fsPath, filePath));
    }

    return vscode.Uri.file(path.resolve(filePath));
  }

  private async openAndReveal(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<vscode.TextEditor> {
    const uri = this.resolveFileUri(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
      preview: false,
      preserveFocus: false,
    });

    const maxLine = Math.max(0, doc.lineCount - 1);
    const start0 = Math.max(0, Math.min(maxLine, startLine - 1));
    const end0 = Math.max(start0, Math.min(maxLine, endLine - 1));
    const range = new vscode.Range(
      new vscode.Position(start0, 0),
      new vscode.Position(end0, 0)
    );

    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    return editor;
  }

  private async syncContext(): Promise<void> {
    await vscode.commands.executeCommand(
      'setContext',
      'codewalk.hasTour',
      this.tour !== null
    );
  }

  private refreshUI(): void {
    this.treeProvider.update(this.tour);

    if (this.tour) {
      const pending = this.tour.questions.filter((q) => !q.answer).length;
      const pendingSuffix = pending > 0 ? ` · $(question) ${pending}` : '';
      this.statusBarItem.text = `$(book) CodeWalk: ${
        this.tour.currentStepIndex + 1
      }/${this.tour.steps.length}${pendingSuffix}`;
      this.statusBarItem.tooltip = `${this.tour.title} — Clic para ir al siguiente paso (Alt+→)`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  public dispose(): void {
    this.spotlight.dispose();
    this.comments.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
