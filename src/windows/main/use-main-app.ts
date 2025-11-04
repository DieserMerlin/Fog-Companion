import { create } from "zustand";

export enum MainAppTab {
  WELCOME,
  MODE_1V1,
  MODE_SCRIMS,
  SETTINGS,
  ACCOUNT,
  ABOUT
}

export const useMainApp = create<{ tab: MainAppTab, mode: 'desktop' | 'in-game' }>(set => ({ tab: MainAppTab.WELCOME, mode: 'in-game' }));
