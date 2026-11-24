import * as vscode from 'vscode';
import { i18n } from './i18n';
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
    this.syncControllerOptions();
  }

  public syncControllerOptions(): void {
    this.controller.options = {
      placeHolder: i18n.messages.commentPlaceHolder,
      prompt: i18n.messages.commentPrompt,
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
    thread.label = i18n.messages.stepHeader(
      stepIndex + 1,
      totalSteps,
      step.title
    );
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
      new CodeWalkComment(
        'CodeWalk',
        explanation,
        i18n.messages.quickNoteLabel
      ),
    ]);
    thread.label = `CodeWalk — ${title}`;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.canReply = false;
    thread.contextValue = 'codewalk-note';

    this.activeThread = thread;
    this.activeStepId = null;
  }

  public refreshStepComments(
    step: TourStep,
    questions: StepQuestion[],
    stepIndex?: number,
    totalSteps?: number
  ): void {
    if (!this.activeThread || this.activeStepId !== step.id) {
      return;
    }
    this.syncControllerOptions();
    if (typeof stepIndex === 'number' && typeof totalSteps === 'number') {
      this.activeThread.label = i18n.messages.stepHeader(
        stepIndex + 1,
        totalSteps,
        step.title
      );
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
    const m = i18n.messages;
    const comments: vscode.Comment[] = [];

    let mainBody = step.explanation.trim();
    const importantNotes = step.lineNotes.filter((n) => n.important || n.detail);
    if (importantNotes.length > 0) {
      mainBody += `\n\n---\n**${m.keyLinesHeading}**\n`;
      for (const note of importantNotes) {
        if (note.detail) {
          mainBody += `\n- \`L${note.line}\` — **${note.text}**\n  ${note.detail}\n`;
        } else {
          mainBody += `\n- \`L${note.line}\` — **${note.text}**\n`;
        }
      }
    }

    comments.push(new CodeWalkComment('CodeWalk', mainBody, m.explanationLabel));

    for (const q of questions) {
      comments.push(
        new CodeWalkComment(
          m.youAuthor,
          q.question,
          q.answer ? m.answeredLabel : m.pendingLabel,
          new Date(q.createdAt)
        )
      );
      if (q.answer) {
        comments.push(
          new CodeWalkComment(
            'CodeWalk',
            q.answer,
            m.answerLabel,
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
