import * as vscode from 'vscode';
import { BridgeServer } from './bridgeServer';
import { CommentViewManager } from './commentView';
import { i18n, LanguagePreference } from './i18n';
import { SpotlightManager } from './spotlight';
import { TourManager } from './tourManager';
import { TourTreeDataProvider } from './treeView';

let bridgeServer: BridgeServer | null = null;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration('codewalk');
  const initialDim = config.get<boolean>('dimInactiveCode', true);
  const initialLineNotes = config.get<boolean>('showLineNotes', true);
  const initialLang = config.get<LanguagePreference>('language', 'auto');
  const port = config.get<number>('port', 47321);

  i18n.setPreference(initialLang);

  const spotlight = new SpotlightManager(initialDim, initialLineNotes);
  const comments = new CommentViewManager();
  const treeProvider = new TourTreeDataProvider();
  const tourManager = new TourManager(spotlight, comments, treeProvider);

  const treeView = vscode.window.createTreeView('codewalk.tourView', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  const listenerStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99
  );
  listenerStatusBarItem.command = 'codewalk.stopListening';

  const syncListenerStatusBar = (): void => {
    listenerStatusBarItem.text = i18n.messages.listeningStatusBar;
    listenerStatusBarItem.tooltip = i18n.messages.listeningTooltip;
  };
  syncListenerStatusBar();

  const unsubscribeLocale = i18n.onDidChangeLocale(() => {
    syncListenerStatusBar();
  });

  const updateListeningUI = (listening: boolean): void => {
    treeProvider.setListening(listening);
    void vscode.commands.executeCommand(
      'setContext',
      'codewalk.isListening',
      listening
    );
    if (listening) {
      syncListenerStatusBar();
      listenerStatusBarItem.show();
    } else {
      listenerStatusBarItem.hide();
    }
  };

  bridgeServer = new BridgeServer(tourManager, port, updateListeningUI);
  tourManager.setEventDispatcher(
    (event) => bridgeServer?.emitEvent(event) ?? false
  );
  await bridgeServer.start();
  updateListeningUI(false);

  context.subscriptions.push(
    { dispose: unsubscribeLocale },
    tourManager,
    treeView,
    bridgeServer,
    listenerStatusBarItem,
    vscode.commands.registerCommand('codewalk.nextStep', () =>
      tourManager.nextStep()
    ),
    vscode.commands.registerCommand('codewalk.prevStep', () =>
      tourManager.prevStep()
    ),
    vscode.commands.registerCommand(
      'codewalk.goToStep',
      async (index?: number) => {
        if (typeof index === 'number') {
          await tourManager.focusStep({ index });
          return;
        }
        const tour = tourManager.getTour();
        if (!tour) {
          vscode.window.showInformationMessage(i18n.messages.noActiveTour);
          return;
        }
        const picked = await vscode.window.showQuickPick(
          tour.steps.map((s, i) => ({
            label: `${i + 1}. ${s.title}`,
            description: `${s.file}:${s.startLine}-${s.endLine}`,
            index: i,
          })),
          { placeHolder: i18n.messages.selectStepPlaceholder }
        );
        if (picked) {
          await tourManager.focusStep({ index: picked.index });
        }
      }
    ),
    vscode.commands.registerCommand('codewalk.toggleDim', () => {
      const enabled = spotlight.toggleDim();
      vscode.window.setStatusBarMessage(i18n.messages.dimStatus(enabled), 2500);
    }),
    vscode.commands.registerCommand('codewalk.toggleLineNotes', () => {
      const enabled = spotlight.toggleLineNotes();
      vscode.window.setStatusBarMessage(
        i18n.messages.lineNotesStatus(enabled),
        2500
      );
    }),
    vscode.commands.registerCommand('codewalk.clearTour', () =>
      tourManager.clearTour()
    ),
    vscode.commands.registerCommand(
      'codewalk.askQuestion',
      async (reply?: vscode.CommentReply) => {
        if (!reply || !reply.text.trim()) {
          return;
        }
        await tourManager.submitQuestion(reply.text);
      }
    ),
    vscode.commands.registerCommand(
      'codewalk.copyPendingQuestions',
      async () => {
        const prompt = tourManager.buildPendingQuestionsPrompt();
        if (!prompt) {
          vscode.window.showInformationMessage(
            i18n.messages.noPendingQuestions
          );
          return;
        }
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage(i18n.messages.pendingPromptCopied);
      }
    ),
    vscode.commands.registerCommand('codewalk.showBridgeStatus', () => {
      if (bridgeServer?.isRunning()) {
        vscode.window.showInformationMessage(
          i18n.messages.bridgeActive(
            bridgeServer.getPort(),
            bridgeServer.isListening()
          )
        );
      } else {
        vscode.window.showWarningMessage(
          i18n.messages.bridgeInactive(
            bridgeServer?.getPort() ?? port,
            bridgeServer?.getLastError() ?? 'unknown'
          )
        );
      }
    }),
    vscode.commands.registerCommand('codewalk.requestTour', async () => {
      const prompt = await vscode.window.showInputBox({
        title: i18n.messages.requestTourBoxTitle,
        prompt: i18n.messages.requestTourBoxPrompt,
        placeHolder: i18n.messages.requestTourBoxPlaceholder,
      });
      if (!prompt?.trim()) {
        return;
      }
      const editor = vscode.window.activeTextEditor;
      await tourManager.requestTour(prompt, {
        file: editor?.document.uri.fsPath,
      });
    }),
    vscode.commands.registerCommand('codewalk.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage(i18n.messages.openFileFirst);
        return;
      }
      const sel = editor.selection;
      const hasSelection = !sel.isEmpty;
      const startLine = hasSelection ? sel.start.line + 1 : 1;
      const endLine = hasSelection
        ? sel.end.line + 1
        : editor.document.lineCount;
      const selectedCode = hasSelection
        ? editor.document.getText(sel).slice(0, 4000)
        : undefined;

      const customPrompt = await vscode.window.showInputBox({
        title: i18n.messages.explainBoxTitle,
        prompt: hasSelection
          ? i18n.messages.explainSelectionPrompt(startLine, endLine)
          : i18n.messages.explainFilePrompt,
        placeHolder: i18n.messages.explainPlaceholder,
      });
      if (customPrompt === undefined) {
        return;
      }

      const finalPrompt =
        customPrompt.trim() ||
        (hasSelection
          ? i18n.messages.explainSelectionDefault(startLine, endLine)
          : i18n.messages.explainFileDefault);

      await tourManager.requestTour(finalPrompt, {
        file: editor.document.uri.fsPath,
        startLine,
        endLine,
        selectedCode,
      });
    }),
    vscode.commands.registerCommand('codewalk.stopListening', () => {
      if (!bridgeServer?.isListening()) {
        vscode.window.showInformationMessage(
          i18n.messages.notListeningMessage
        );
        return;
      }
      bridgeServer.stopListening();
      vscode.window.showInformationMessage(
        i18n.messages.listeningStoppedMessage
      );
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codewalk.dimInactiveCode')) {
        const dim = vscode.workspace
          .getConfiguration('codewalk')
          .get<boolean>('dimInactiveCode', true);
        spotlight.setDimEnabled(dim);
      }
      if (e.affectsConfiguration('codewalk.showLineNotes')) {
        const show = vscode.workspace
          .getConfiguration('codewalk')
          .get<boolean>('showLineNotes', true);
        spotlight.setLineNotesEnabled(show);
      }
      if (e.affectsConfiguration('codewalk.language')) {
        const pref = vscode.workspace
          .getConfiguration('codewalk')
          .get<LanguagePreference>('language', 'auto');
        i18n.setPreference(pref);
      }
    })
  );
}

export function deactivate(): void {
  bridgeServer?.dispose();
  bridgeServer = null;
}
