export type Locale = 'en' | 'es';
export type LanguagePreference = 'auto' | Locale;

export interface Messages {
  // Comment controller & inline card
  commentPlaceHolder: string;
  commentPrompt: string;
  stepHeader: (current: number, total: number, title: string) => string;
  quickNoteLabel: string;
  explanationLabel: string;
  keyLinesHeading: string;
  youAuthor: string;
  answeredLabel: string;
  pendingLabel: string;
  answerLabel: string;
  lineHover: (line: number, text: string) => string;

  // Sidebar TreeView
  listeningTitle: string;
  noTourTitle: string;
  listeningDesc: string;
  noTourDesc: string;
  requestNewTourTitle: string;
  pendingCount: (count: number) => string;

  // Status bar & notifications
  listeningStatusBar: string;
  listeningTooltip: string;
  tourStatusTooltip: (title: string) => string;
  lastStepMessage: (title: string) => string;
  firstStepMessage: string;
  questionSentStatus: string;
  questionSavedAndCopied: string;
  questionSavedManual: string;
  copyPromptButton: string;
  tourRequestSentStatus: string;
  tourRequestCopiedManual: string;
  noActiveTour: string;
  selectStepPlaceholder: string;
  dimStatus: (enabled: boolean) => string;
  lineNotesStatus: (enabled: boolean) => string;
  noPendingQuestions: string;
  pendingPromptCopied: string;
  bridgeActive: (port: number, listening: boolean) => string;
  bridgeInactive: (port: number, error: string) => string;
  requestTourBoxTitle: string;
  requestTourBoxPrompt: string;
  requestTourBoxPlaceholder: string;
  openFileFirst: string;
  explainBoxTitle: string;
  explainSelectionPrompt: (start: number, end: number) => string;
  explainFilePrompt: string;
  explainPlaceholder: string;
  explainSelectionDefault: (start: number, end: number) => string;
  explainFileDefault: string;
  notListeningMessage: string;
  listeningStoppedMessage: string;
  additionalNoteQuestion: string;

  // Prompts copied in manual mode
  manualQuestionPrompt: (
    stepNum: number,
    stepTitle: string,
    fileBase: string,
    lineRef: string,
    question: string,
    questionId: string
  ) => string;
  manualPendingPrompt: (count: number, tourTitle: string) => string;
  manualTourRequestPrompt: (prompt: string, locationPart: string) => string;
}

const EN: Messages = {
  commentPlaceHolder: 'Ask a question about this code block...',
  commentPrompt: 'Ask about this step',
  stepHeader: (current, total, title) => `Step ${current}/${total} — ${title}`,
  quickNoteLabel: 'Quick note',
  explanationLabel: 'Explanation',
  keyLinesHeading: 'Most important lines:',
  youAuthor: 'You',
  answeredLabel: 'Answered',
  pendingLabel: 'Pending',
  answerLabel: 'Answer',
  lineHover: (line, text) => `**Line ${line}**: ${text}`,

  listeningTitle: 'Agent listening',
  noTourTitle: 'No active tour',
  listeningDesc: 'Click + to request a tour',
  noTourDesc: 'Waiting for agent via MCP',
  requestNewTourTitle: 'Request New Tour',
  pendingCount: (count) =>
    `${count} pending question${count === 1 ? '' : 's'}`,

  listeningStatusBar: '$(radio-tower) CodeWalk: Listening',
  listeningTooltip:
    'Your AI agent is listening for questions and tour requests. Click to stop.',
  tourStatusTooltip: (title) => `${title} — Click for next step (Alt+→)`,
  lastStepMessage: (title) =>
    `CodeWalk: You reached the last step of "${title}".`,
  firstStepMessage: 'CodeWalk: You are already on the first step.',
  questionSentStatus: '$(sync~spin) CodeWalk: Question sent to agent...',
  questionSavedAndCopied:
    'CodeWalk: Question saved and prompt copied to clipboard. Paste it into your AI agent to get an inline reply.',
  questionSavedManual: 'CodeWalk: Question saved for your AI agent.',
  copyPromptButton: 'Copy prompt',
  tourRequestSentStatus:
    '$(sync~spin) CodeWalk: Tour request sent to agent...',
  tourRequestCopiedManual:
    'CodeWalk (manual mode): Prompt copied to clipboard. Paste it into your AI agent (or enable active listening).',
  noActiveTour: 'CodeWalk: No active tour.',
  selectStepPlaceholder: 'Select a walkthrough step',
  dimStatus: (enabled) =>
    `CodeWalk: Spotlight dim ${enabled ? 'enabled' : 'disabled'}`,
  lineNotesStatus: (enabled) =>
    `CodeWalk: Line-by-line notes ${enabled ? 'enabled' : 'disabled'}`,
  noPendingQuestions: 'CodeWalk: No pending questions.',
  pendingPromptCopied:
    'CodeWalk: Pending questions prompt copied to clipboard.',
  bridgeActive: (port, listening) =>
    `CodeWalk MCP Bridge active on http://127.0.0.1:${port} (${
      listening ? 'Active listening' : 'Manual mode'
    })`,
  bridgeInactive: (port, error) =>
    `CodeWalk MCP Bridge is not listening on port ${port} (${error}).`,
  requestTourBoxTitle: 'CodeWalk: New Walkthrough',
  requestTourBoxPrompt: 'Which feature or part of the codebase should I explain?',
  requestTourBoxPlaceholder: 'e.g. How the authentication flow works step by step',
  openFileFirst: 'CodeWalk: Open a file first to explain it.',
  explainBoxTitle: 'CodeWalk: Explain Code',
  explainSelectionPrompt: (start, end) =>
    `What would you like to understand about lines ${start}-${end}? (Press Enter for a general explanation)`,
  explainFilePrompt:
    'What would you like to understand about this file? (Press Enter for a general explanation)',
  explainPlaceholder: 'Optional: focus on error handling, data flow...',
  explainSelectionDefault: (start, end) =>
    `Explain this code block in detail (lines ${start}-${end}).`,
  explainFileDefault: 'Walk me through this file step by step.',
  notListeningMessage: 'CodeWalk: No agent was listening right now.',
  listeningStoppedMessage: 'CodeWalk: Active listening stopped.',
  additionalNoteQuestion: '(Additional note)',

  manualQuestionPrompt: (stepNum, stepTitle, fileBase, lineRef, question, questionId) =>
    `[codewalk] Question on step ${stepNum} ("${stepTitle}", ${fileBase}:${lineRef}): "${question}" — Reply using codewalk_reply (questionId: "${questionId}").`,
  manualPendingPrompt: (count, tourTitle) =>
    `[codewalk] I have ${count} pending questions in the tour "${tourTitle}". Use codewalk_get_questions to read them and answer with codewalk_reply.`,
  manualTourRequestPrompt: (prompt, locationPart) =>
    `[codewalk] Create an interactive walkthrough with codewalk_create_tour (including lineNotes): ${prompt}${locationPart}`,
};

const ES: Messages = {
  commentPlaceHolder: 'Escribe una pregunta sobre este bloque de código...',
  commentPrompt: 'Pregunta sobre este paso',
  stepHeader: (current, total, title) => `Paso ${current}/${total} — ${title}`,
  quickNoteLabel: 'Nota rápida',
  explanationLabel: 'Explicación',
  keyLinesHeading: 'Líneas más importantes:',
  youAuthor: 'Tú',
  answeredLabel: 'Respondida',
  pendingLabel: 'Pendiente',
  answerLabel: 'Respuesta',
  lineHover: (line, text) => `**Línea ${line}**: ${text}`,

  listeningTitle: 'Agente escuchando',
  noTourTitle: 'Sin recorrido activo',
  listeningDesc: 'Pulsa + para pedir un tour',
  noTourDesc: 'Esperando al agente por MCP',
  requestNewTourTitle: 'Solicitar nuevo tour',
  pendingCount: (count) => `${count} duda${count === 1 ? '' : 's'}`,

  listeningStatusBar: '$(radio-tower) CodeWalk: Escuchando',
  listeningTooltip:
    'Tu agente de IA está escuchando tus preguntas y peticiones de tour. Clic para detener.',
  tourStatusTooltip: (title) => `${title} — Clic para ir al siguiente paso (Alt+→)`,
  lastStepMessage: (title) =>
    `CodeWalk: Has llegado al último paso de "${title}".`,
  firstStepMessage: 'CodeWalk: Ya estás en el primer paso.',
  questionSentStatus: '$(sync~spin) CodeWalk: Pregunta enviada al agente...',
  questionSavedAndCopied:
    'CodeWalk: Pregunta guardada y prompt copiado al portapapeles. Pégalo en tu agente para que responda aquí.',
  questionSavedManual: 'CodeWalk: Pregunta guardada para tu agente.',
  copyPromptButton: 'Copiar prompt',
  tourRequestSentStatus:
    '$(sync~spin) CodeWalk: Petición de tour enviada al agente...',
  tourRequestCopiedManual:
    'CodeWalk (modo manual): Prompt copiado al portapapeles. Pégalo en tu agente (o activa el modo escucha).',
  noActiveTour: 'CodeWalk: No hay ningún recorrido activo.',
  selectStepPlaceholder: 'Selecciona un paso del recorrido',
  dimStatus: (enabled) =>
    `CodeWalk: Atenuado ${enabled ? 'activado' : 'desactivado'}`,
  lineNotesStatus: (enabled) =>
    `CodeWalk: Notas línea a línea ${enabled ? 'activadas' : 'desactivadas'}`,
  noPendingQuestions: 'CodeWalk: No hay preguntas pendientes.',
  pendingPromptCopied:
    'CodeWalk: Prompt de preguntas pendientes copiado al portapapeles.',
  bridgeActive: (port, listening) =>
    `CodeWalk MCP Bridge activo en http://127.0.0.1:${port} (${
      listening ? 'Escuchando activamente' : 'Modo manual'
    })`,
  bridgeInactive: (port, error) =>
    `CodeWalk MCP Bridge no está escuchando en el puerto ${port} (${error}).`,
  requestTourBoxTitle: 'CodeWalk: Nuevo recorrido',
  requestTourBoxPrompt:
    '¿Qué funcionalidad o parte del proyecto quieres que te explique?',
  requestTourBoxPlaceholder:
    'Ej: Cómo funciona el sistema de autenticación paso a paso',
  openFileFirst: 'CodeWalk: Abre un archivo primero para explicarlo.',
  explainBoxTitle: 'CodeWalk: Explicar código',
  explainSelectionPrompt: (start, end) =>
    `¿Qué quieres entender de estas líneas (${start}-${end})? (Enter para explicación general)`,
  explainFilePrompt:
    '¿Qué quieres entender de este archivo? (Enter para explicación general)',
  explainPlaceholder: 'Opcional: enfócate en el manejo de errores, flujo de datos...',
  explainSelectionDefault: (start, end) =>
    `Explícame en detalle este bloque de código (líneas ${start}-${end}).`,
  explainFileDefault: 'Explícame paso a paso cómo funciona este archivo.',
  notListeningMessage: 'CodeWalk: No había ningún agente escuchando ahora mismo.',
  listeningStoppedMessage: 'CodeWalk: Modo escucha detenido.',
  additionalNoteQuestion: '(Nota adicional)',

  manualQuestionPrompt: (stepNum, stepTitle, fileBase, lineRef, question, questionId) =>
    `[codewalk] Pregunta en paso ${stepNum} ("${stepTitle}", ${fileBase}:${lineRef}): "${question}" — Respóndela usando codewalk_reply (questionId: "${questionId}").`,
  manualPendingPrompt: (count, tourTitle) =>
    `[codewalk] Tengo ${count} preguntas pendientes en el recorrido "${tourTitle}". Usa codewalk_get_questions para leerlas y respóndelas con codewalk_reply.`,
  manualTourRequestPrompt: (prompt, locationPart) =>
    `[codewalk] Crea un recorrido interactivo con codewalk_create_tour (incluyendo lineNotes): ${prompt}${locationPart}`,
};

const SPANISH_DIACRITICS_OR_PUNCT = /[¿¡áéíóúüñÁÉÍÓÚÜÑ]/;
const SPANISH_STOPWORDS =
  /\b(qu[eé]|c[oó]mo|por qu[eé]|d[oó]nde|cu[aá]ndo|cu[aá]l|para|este|esta|esto|estos|estas|aqu[ií]|c[oó]digo|funci[oó]n|archivo|paso|explica|expl[ií]came|flujo|sirve|hace|ejecuta|llama|desde|sobre|entre|porque|pero|sino|tamb[ií]en|aunque|puedo|puede|debe|tiene|hay|son|est[aá])\b/gi;
const ENGLISH_STOPWORDS =
  /\b(what|how|why|where|when|which|this|that|these|those|here|code|function|file|step|explain|flow|does|runs|calls|from|about|between|because|should|would|could|have|has|there|are|is|the)\b/gi;

export function detectLocaleFromText(text: string): Locale | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (SPANISH_DIACRITICS_OR_PUNCT.test(trimmed)) {
    return 'es';
  }

  const esMatches = trimmed.match(SPANISH_STOPWORDS)?.length ?? 0;
  const enMatches = trimmed.match(ENGLISH_STOPWORDS)?.length ?? 0;

  if (esMatches >= 2 && esMatches > enMatches) {
    return 'es';
  }
  if (enMatches >= 2 && enMatches > esMatches) {
    return 'en';
  }
  if (esMatches === 1 && enMatches === 0) {
    return 'es';
  }

  return null;
}

class I18nManager {
  private preference: LanguagePreference = 'auto';
  private activeLocale: Locale = 'en';
  private readonly listeners = new Set<(locale: Locale) => void>();

  public getLocale(): Locale {
    return this.activeLocale;
  }

  public get messages(): Messages {
    return this.activeLocale === 'es' ? ES : EN;
  }

  public setPreference(pref: LanguagePreference): void {
    this.preference = pref;
    const next: Locale = pref === 'auto' ? this.activeLocale : pref;
    this.applyLocale(next);
  }

  public setExplicitLocale(locale: Locale): void {
    if (this.preference !== 'auto') {
      return;
    }
    this.applyLocale(locale);
  }

  public detectAndApply(text: string): Locale {
    if (this.preference !== 'auto') {
      return this.activeLocale;
    }
    const detected = detectLocaleFromText(text);
    if (detected) {
      this.applyLocale(detected);
    }
    return this.activeLocale;
  }

  public onDidChangeLocale(listener: (locale: Locale) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private applyLocale(locale: Locale): void {
    if (this.activeLocale === locale) {
      return;
    }
    this.activeLocale = locale;
    for (const listener of this.listeners) {
      listener(locale);
    }
  }
}

export const i18n = new I18nManager();
