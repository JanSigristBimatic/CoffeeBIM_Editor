export interface BimViewerRef {
  captureScreenshot: () => string | null;
}

export interface GenerationResult {
  imageUrl: string;
  prompt: string;
}

export enum AppState {
  VIEWING = 'VIEWING',
  EDITING = 'EDITING',
  LOADING = 'LOADING',
  RESULT = 'RESULT',
}