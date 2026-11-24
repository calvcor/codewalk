import * as vscode from 'vscode';
import { StepQuestion, TourStep } from './types';

class CodeWalkComment implements vscode.Comment {
  public body: vscode.MarkdownString;
  public mode: vscode.CommentMode = vscode.CommentMode.Preview;
  public author: vscode.CommentAuthorInformation;
  public label?: string;
  public timestamp?: Date;

  constructor(
    authorName: string,
    markdown: string,
    label?: string,
    timestamp?: Date
  ) {
    const md = new vscode.MarkdownString(markdown);
    md.isTrusted = true;
    md.supportThemeIcons = true;
    this.body = md;
    this.author = { name: authorName };
    this.label = label;
    this.timestamp = timestamp;
  }
}

export class CommentViewManager implements vscode.Disposable {
  private readonly controller: vscode.CommentController;
  private activeThread: vscode.CommentThread | null = null;
  private activeStepId: string | null = null;

  constructor() {
    this.controller = vscode.comments.createCommentController(
      'codewalk',
      'CodeWalk'
    );
    this.controller.options = {
      placeHolder: 'Escribe una pregunta sobre este bloque de código...',
      prompt: 'Pregunta sobre este paso',
    };
  }

  public getActiveStepId(): string | null {
    return this.activeStepId;
  }

  public showStep(
    uri: vscode.Uri,
    step: TourStep,
    stepIndex: number,
    totalSteps: number,
    questions: StepQuestion[]
  ): void {
    this.clear();

    const startLine0 = Math.max(0, step.startLine - 1);
    const endLine0 = Math.max(startLine0, step.endLine - 1);
    const range = new vscode.Range(
      new vscode.Position(startLine0, 0),
      new vscode.Position(endLine0, 0)
    );

    const comments = this.buildComments(step, questions);
    const thread = this.controller.createCommentThread(uri, range, comments);
    thread.label = `Paso ${stepIndex + 1}/${totalSteps} — ${step.title}`;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.canReply = true;
    thread.contextValue = 'codewalk-step';

    this.activeThread = thread;
    this.activeStepId = step.id;
  }

  public showQuickHighlight(
    uri: vscode.Uri,
    title: string,
    startLine: number,
    endLine: number,
    explanation: string
  ): void {
    this.clear();

    const startLine0 = Math.max(0, startLine - 1);
    const endLine0 = Math.max(startLine0, endLine - 1);
    const range = new vscode.Range(
      new vscode.Position(startLine0, 0),
      new vscode.Position(endLine0, 0)
    );

    const thread = this.controller.createCommentThread(uri, range, [
      new CodeWalkComment('CodeWalk', explanation, 'Nota rápida'),
    ]);
    thread.label = `CodeWalk — ${title}`;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.canReply = false;
    thread.contextValue = 'codewalk-note';

    this.activeThread = thread;
    this.activeStepId = null;
  }

  public refreshStepComments(step: TourStep, questions: StepQuestion[]): void {
    if (!this.activeThread || this.activeStepId !== step.id) {
      return;
    }
    this.activeThread.comments = this.buildComments(step, questions);
    this.activeThread.collapsibleState =
      vscode.CommentThreadCollapsibleState.Expanded;
  }

  public clear(): void {
    if (this.activeThread) {
      this.activeThread.dispose();
      this.activeThread = null;
    }
    this.activeStepId = null;
  }

  private buildComments(
    step: TourStep,
    questions: StepQuestion[]
  ): vscode.Comment[] {
    const comments: vscode.Comment[] = [];

    let mainBody = step.explanation.trim();
    const importantNotes = step.lineNotes.filter((n) => n.important || n.detail);
    if (importantNotes.length > 0) {
      mainBody += '\n\n---\n**Líneas más importantes:**\n';
      for (const note of importantNotes) {
        if (note.detail) {
          mainBody += `\n- \`L${note.line}\` — **${note.text}**\n  ${note.detail}\n`;
        } else {
          mainBody += `\n- \`L${note.line}\` — **${note.text}**\n`;
        }
      }
    }

    comments.push(new CodeWalkComment('CodeWalk', mainBody, 'Explicación'));

    for (const q of questions) {
      comments.push(
        new CodeWalkComment(
          'Tú',
          q.question,
          q.answer ? 'Respondida' : 'Pendiente',
          new Date(q.createdAt)
        )
      );
      if (q.answer) {
        comments.push(
          new CodeWalkComment(
            'CodeWalk',
            q.answer,
            'Respuesta',
            q.answeredAt ? new Date(q.answeredAt) : undefined
          )
        );
      }
    }

    return comments;
  }

  public dispose(): void {
    this.clear();
    this.controller.dispose();
  }
}
