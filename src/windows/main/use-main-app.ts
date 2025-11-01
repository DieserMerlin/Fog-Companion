import { create } from "zustand";

export enum MainAppTab {
  WELCOME,
  SETTINGS,
  ABOUT
}

export const useMainApp = create<{ tab: MainAppTab, mode: 'desktop' | 'in-game' }>(set => ({ tab: MainAppTab.WELCOME, mode: 'in-game' }));
