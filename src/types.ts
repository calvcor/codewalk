export interface LineNote {
  line: number;
  text: string;
  detail?: string;
  important?: boolean;
}

export interface TourStepInput {
  id?: string;
  title: string;
  file: string;
  startLine: number;
  endLine?: number;
  explanation: string;
  lineNotes?: LineNote[];
}

export interface TourStep {
  id: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  explanation: string;
  lineNotes: LineNote[];
}

export interface StepQuestion {
  id: string;
  stepId: string;
  stepIndex: number;
  stepTitle: string;
  file: string;
  startLine: number;
  endLine: number;
  question: string;
  answer?: string;
  createdAt: string;
  answeredAt?: string;
}

export interface Tour {
  id: string;
  title: string;
  summary?: string;
  steps: TourStep[];
  currentStepIndex: number;
  visitedStepIds: string[];
  questions: StepQuestion[];
  createdAt: string;
}

export interface CreateTourPayload {
  title: string;
  summary?: string;
  steps: TourStepInput[];
  startIndex?: number;
}

export interface AddStepsPayload {
  steps: TourStepInput[];
}

export interface FocusStepPayload {
  stepId?: string;
  index?: number;
}

export interface HighlightCodePayload {
  file: string;
  startLine: number;
  endLine?: number;
  title?: string;
  explanation: string;
  lineNotes?: LineNote[];
}

export interface ReplyPayload {
  stepId?: string;
  questionId?: string;
  answer: string;
  focusStep?: boolean;
}

export interface BridgeHealthResponse {
  ok: boolean;
  version: string;
  port: number;
  listening: boolean;
  workspaceFolders: string[];
  activeTour: {
    id: string;
    title: string;
    stepCount: number;
    currentStepIndex: number;
    pendingQuestions: number;
  } | null;
}

export interface TourRequestEvent {
  type: 'tour_request';
  id: string;
  prompt: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  selectedCode?: string;
  createdAt: string;
}

export type CodeWalkEvent =
  | {
      type: 'question';
      question: StepQuestion;
    }
  | TourRequestEvent
  | {
      type: 'stop_listening';
      createdAt: string;
    };
