import { create } from 'zustand';
import { OcrRecordingCycle } from '../../background/ocr-recording-types';

export type { OcrRecordingCycle };

type RecordingStore = {
  open: boolean;
  active: boolean;
  cycles: OcrRecordingCycle[];
  stateTransitions: number;
  lastStateType: string | null;
  exportedFileName: string | null;
};

export const useRecording = create<RecordingStore>(() => ({
  open: false,
  active: false,
  cycles: [],
  stateTransitions: 0,
  lastStateType: null,
  exportedFileName: null,
}));

export function initRecordingBus() {
  const bus = overwolf.windows.getMainWindow().bus;
  bus.on('ocr-recording-cycle', (cycle) => {
    const { active, cycles, lastStateType } = useRecording.getState();
    if (!active) return;
    const newTransition = cycle.gameState.type !== lastStateType;
    useRecording.setState({
      cycles: [...cycles, cycle],
      stateTransitions: useRecording.getState().stateTransitions + (newTransition ? 1 : 0),
      lastStateType: cycle.gameState.type,
    });
  });
}
