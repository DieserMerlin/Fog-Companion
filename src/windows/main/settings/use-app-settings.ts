import { create } from "zustand";

export enum AppSettingsSection {
  CALLOUT,
  MODE_1v1,
  OBS,
}

export const useAppSettings = create<{ expand: AppSettingsSection | null }>(set => ({ expand: null }));
