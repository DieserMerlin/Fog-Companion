import { create } from "zustand";
import { createStorage } from "../../utils/localstorage/typed-localstorage";


export type CalloutSettings = {
  size: number;
  opacity: number;

  autoDetect: boolean;

  showHotkeys: boolean;

  browser: boolean;
}

export const CALLOUT_SETTINGS = createStorage<CalloutSettings>('CALLOUT_SETTINGS', {
  size: .4,
  opacity: .5,

  autoDetect: true,

  showHotkeys: true,

  browser: false,
});

export const useCalloutVariant = create<{ variant: number, next: () => void }>((set, get) => ({ variant: 0, next: () => set({ variant: get().variant + 1 }) }));
