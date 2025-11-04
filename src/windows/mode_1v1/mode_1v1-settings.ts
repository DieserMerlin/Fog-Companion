import { create } from "zustand";
import { createStorage } from "../../utils/localstorage/typed-localstorage";
import { Mode1v1DefaultTheme, Mode1v1TimerTheme } from "@diesermerlin/fog-companion-web";

export type Mode1v1Settings = {
  startKllrOnSwing: boolean;
  startSurvOnCrouch: boolean;
  stopOnEmote: boolean;

  showMs: boolean;
  showHotkeys: boolean;

  customCss: string;

  selected: 'kllr' | 'surv';
}

export const MODE_1V1_SETTINGS = createStorage<Mode1v1Settings>('MODE_1V1_SETTINGS', {
  startKllrOnSwing: true,
  startSurvOnCrouch: true,
  stopOnEmote: true,

  showMs: true,
  showHotkeys: true,

  customCss: '',

  selected: 'surv',
});

export const useMode1v1Theme = create<{ theme: Mode1v1TimerTheme }>(() => ({ theme: Mode1v1DefaultTheme }));
