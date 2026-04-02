import { GameState } from '../../game_state/GameState';
import { OcrAreasResult } from '../../utils/ocr/area-ocr';

export type OcrRecordingCycle = {
  ts: number;
  gameState: GameState;
  ocrResult: OcrAreasResult;
  screenshotDataUrl: string | null;
  canvasDataUrls: Record<string, string>;
};
