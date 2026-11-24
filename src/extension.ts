import * as vscode from 'vscode';
import { BridgeServer } from './bridgeServer';
import { CommentViewManager } from './commentView';
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
  const port = config.get<number>('port', 47321);

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
  listenerStatusBarItem.text = '$(radio-tower) CodeWalk: Escuchando';
  listenerStatusBarItem.tooltip =
    'Antigravity está escuchando tus preguntas y peticiones de tour. Clic para detener.';
  listenerStatusBarItem.command = 'codewalk.stopListening';

  const updateListeningUI = (listening: boolean): void => {
    treeProvider.setListening(listening);
    void vscode.commands.executeCommand(
      'setContext',
      'codewalk.isListening',
      listening
    );
    if (listening) {
      listenerStatusBarItem.show();
    } else {
      listenerStatusBarItem.hide();
    }
  };

  bridgeServer = new BridgeServer(tourManager, port, updateListeningUI);
  tourManager.setEventDispatcher((event) => bridgeServer?.emitEvent(event) ?? false);
  await bridgeServer.start();
  updateListeningUI(false);

  context.subscriptions.push(
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
          vscode.window.showInformationMessage(
            'CodeWalk: No hay ningún recorrido activo.'
          );
          return;
        }
        const picked = await vscode.window.showQuickPick(
          tour.steps.map((s, i) => ({
            label: `${i + 1}. ${s.title}`,
            description: `${s.file}:${s.startLine}-${s.endLine}`,
            index: i,
          })),
          { placeHolder: 'Selecciona un paso del recorrido' }
        );
        if (picked) {
          await tourManager.focusStep({ index: picked.index });
        }
      }
    ),
    vscode.commands.registerCommand('codewalk.toggleDim', () => {
      const enabled = spotlight.toggleDim();
      vscode.window.setStatusBarMessage(
        `CodeWalk: Atenuado ${enabled ? 'activado' : 'desactivado'}`,
        2500
      );
    }),
    vscode.commands.registerCommand('codewalk.toggleLineNotes', () => {
      const enabled = spotlight.toggleLineNotes();
      vscode.window.setStatusBarMessage(
        `CodeWalk: Notas línea a línea ${enabled ? 'activadas' : 'desactivadas'}`,
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
            'CodeWalk: No hay preguntas pendientes.'
          );
          return;
        }
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage(
          'CodeWalk: Prompt de preguntas pendientes copiado al portapapeles.'
        );
      }
    ),
    vscode.commands.registerCommand('codewalk.showBridgeStatus', () => {
      if (bridgeServer?.isRunning()) {
        const mode = bridgeServer.isListening()
          ? 'Escuchando activamente'
          : 'Modo manual';
        vscode.window.showInformationMessage(
          `CodeWalk MCP Bridge activo en http://127.0.0.1:${bridgeServer.getPort()} (${mode})`
        );
      } else {
        vscode.window.showWarningMessage(
          `CodeWalk MCP Bridge no está escuchando en el puerto ${bridgeServer?.getPort() ?? port} (${bridgeServer?.getLastError() ?? 'desconocido'}).`
        );
      }
    }),
    vscode.commands.registerCommand('codewalk.requestTour', async () => {
      const prompt = await vscode.window.showInputBox({
        title: 'CodeWalk: Nuevo recorrido',
        prompt: '¿Qué funcionalidad o parte del proyecto quieres que te explique?',
        placeHolder: 'Ej: Cómo funciona el sistema de autenticación paso a paso',
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
        vscode.window.showInformationMessage(
          'CodeWalk: Abre un archivo primero para explicarlo.'
        );
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
        title: 'CodeWalk: Explicar código',
        prompt: hasSelection
          ? `¿Qué quieres entender de estas líneas (${startLine}-${endLine})? (Enter para explicación general)`
          : '¿Qué quieres entender de este archivo? (Enter para explicación general)',
        placeHolder: 'Opcional: enfócate en el manejo de errores, flujo de datos...',
      });
      if (customPrompt === undefined) {
        return;
      }

      const finalPrompt =
        customPrompt.trim() ||
        (hasSelection
          ? `Explícame en detalle este bloque de código (líneas ${startLine}-${endLine}).`
          : 'Explícame paso a paso cómo funciona este archivo.');

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
          'CodeWalk: Antigravity no estaba escuchando en este momento.'
        );
        return;
      }
      bridgeServer.stopListening();
      vscode.window.showInformationMessage(
        'CodeWalk: Modo escucha detenido.'
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
    })
  );
}

export function deactivate(): void {
  bridgeServer?.dispose();
  bridgeServer = null;
}
