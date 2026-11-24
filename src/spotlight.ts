import * as vscode from 'vscode';
import { i18n } from './i18n';
import { LineNote } from './types';

const MAX_INLINE_NOTE_LENGTH = 90;

export class SpotlightManager implements vscode.Disposable {
  private readonly primaryDecoration: vscode.TextEditorDecorationType;
  private readonly lineNoteDecoration: vscode.TextEditorDecorationType;
  private readonly dimDecoration: vscode.TextEditorDecorationType;

  private activeUri: string | null = null;
  private activeStartLine = 0;
  private activeEndLine = 0;
  private activeLineNotes: LineNote[] = [];
  private dimEnabled: boolean;
  private lineNotesEnabled: boolean;

  constructor(initialDimEnabled: boolean, initialLineNotesEnabled = true) {
    this.dimEnabled = initialDimEnabled;
    this.lineNotesEnabled = initialLineNotesEnabled;

    this.primaryDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(99, 102, 241, 0.14)',
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: '#6366f1',
      overviewRulerColor: '#6366f1',
      overviewRulerLane: vscode.OverviewRulerLane.Full,
    });

    this.lineNoteDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(129, 140, 248, 0.12)',
    });

    this.dimDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      opacity: '0.42',
    });
  }

  public isDimEnabled(): boolean {
    return this.dimEnabled;
  }

  public setDimEnabled(enabled: boolean): void {
    this.dimEnabled = enabled;
    this.reapplyToVisibleEditors();
  }

  public toggleDim(): boolean {
    this.dimEnabled = !this.dimEnabled;
    this.reapplyToVisibleEditors();
    return this.dimEnabled;
  }

  public setLineNotesEnabled(enabled: boolean): void {
    this.lineNotesEnabled = enabled;
    this.reapplyToVisibleEditors();
  }

  public toggleLineNotes(): boolean {
    this.lineNotesEnabled = !this.lineNotesEnabled;
    this.reapplyToVisibleEditors();
    return this.lineNotesEnabled;
  }

  public apply(
    editor: vscode.TextEditor,
    startLine: number,
    endLine: number,
    lineNotes: LineNote[] = []
  ): void {
    this.clearAllEditors();

    this.activeUri = editor.document.uri.toString();
    this.activeStartLine = startLine;
    this.activeEndLine = endLine;
    this.activeLineNotes = lineNotes;

    this.decorateEditor(editor);
  }

  public reapplyToVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      if (this.activeUri && editor.document.uri.toString() === this.activeUri) {
        this.decorateEditor(editor);
      } else {
        this.clearEditor(editor);
      }
    }
  }

  public clear(): void {
    this.activeUri = null;
    this.activeLineNotes = [];
    this.clearAllEditors();
  }

  private decorateEditor(editor: vscode.TextEditor): void {
    const lineCount = editor.document.lineCount;
    if (lineCount === 0) {
      return;
    }

    const clamp = (line1Based: number): number =>
      Math.max(0, Math.min(lineCount - 1, line1Based - 1));

    const startIdx = clamp(this.activeStartLine);
    const endIdx = Math.max(startIdx, clamp(this.activeEndLine));

    const primaryRange = new vscode.Range(
      new vscode.Position(startIdx, 0),
      new vscode.Position(endIdx, editor.document.lineAt(endIdx).text.length)
    );
    editor.setDecorations(this.primaryDecoration, [primaryRange]);

    const highlightedLines = new Set<number>();
    for (let i = startIdx; i <= endIdx; i++) {
      highlightedLines.add(i);
    }

    if (this.lineNotesEnabled && this.activeLineNotes.length > 0) {
      const noteOptions: vscode.DecorationOptions[] = [];
      for (const note of this.activeLineNotes) {
        const lineIdx = clamp(note.line);
        highlightedLines.add(lineIdx);
        const lineTextLen = editor.document.lineAt(lineIdx).text.length;
        const cleanText = note.text.replace(/\s+/g, ' ').trim();
        const shortText =
          cleanText.length > MAX_INLINE_NOTE_LENGTH
            ? `${cleanText.slice(0, MAX_INLINE_NOTE_LENGTH - 1)}…`
            : cleanText;

        const hoverParts = [i18n.messages.lineHover(note.line, note.text)];
        if (note.detail) {
          hoverParts.push(note.detail);
        }
        const hoverMd = new vscode.MarkdownString(hoverParts.join('\n\n'));
        hoverMd.isTrusted = true;

        noteOptions.push({
          range: new vscode.Range(
            new vscode.Position(lineIdx, 0),
            new vscode.Position(lineIdx, lineTextLen)
          ),
          hoverMessage: hoverMd,
          renderOptions: {
            after: {
              contentText: `  ← ${shortText} `,
              color: new vscode.ThemeColor('editorInlayHint.foreground'),
              backgroundColor: new vscode.ThemeColor(
                'editorInlayHint.background'
              ),
              fontStyle: 'italic',
              margin: '0 0 0 1.4em',
            },
          },
        });
      }
      editor.setDecorations(this.lineNoteDecoration, noteOptions);
    } else {
      editor.setDecorations(this.lineNoteDecoration, []);
    }

    if (this.dimEnabled) {
      const dimRanges: vscode.Range[] = [];
      let blockStart: number | null = null;
      for (let i = 0; i < lineCount; i++) {
        if (!highlightedLines.has(i)) {
          if (blockStart === null) {
            blockStart = i;
          }
        } else if (blockStart !== null) {
          dimRanges.push(
            new vscode.Range(
              new vscode.Position(blockStart, 0),
              new vscode.Position(i - 1, editor.document.lineAt(i - 1).text.length)
            )
          );
          blockStart = null;
        }
      }
      if (blockStart !== null) {
        dimRanges.push(
          new vscode.Range(
            new vscode.Position(blockStart, 0),
            new vscode.Position(
              lineCount - 1,
              editor.document.lineAt(lineCount - 1).text.length
            )
          )
        );
      }
      editor.setDecorations(this.dimDecoration, dimRanges);
    } else {
      editor.setDecorations(this.dimDecoration, []);
    }
  }

  private clearEditor(editor: vscode.TextEditor): void {
    editor.setDecorations(this.primaryDecoration, []);
    editor.setDecorations(this.lineNoteDecoration, []);
    editor.setDecorations(this.dimDecoration, []);
  }

  private clearAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.clearEditor(editor);
    }
  }

  public dispose(): void {
    this.clear();
    this.primaryDecoration.dispose();
    this.lineNoteDecoration.dispose();
    this.dimDecoration.dispose();
  }
}
