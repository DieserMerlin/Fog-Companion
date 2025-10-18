import { create } from "zustand";
import { useMapDir } from "./use-callout-map-dir";
import { CALLOUT_SETTINGS } from "../callout-settings";

export const useMapBrowserNavigation = create<{
  selectedRealmIndex: number,
  selectedMapIndex: number,
  realmOpen: boolean,
  next: () => void,
  previous: () => void,
  open: () => void,
  close: (fully?: boolean) => void,
  ref: { onOpenCallback: () => void }
}>((set, get) => {
  const dir = () => useMapDir.getState().realms;

  return {
    selectedRealmIndex: 0,
    selectedMapIndex: 0,
    realmOpen: false,

    next: () => {
      const _dir = dir();
      const realms = !!_dir && Object.keys(_dir);


      if (!realms || Object.keys(realms).length === 0) return;

      // normalize current realm index
      let realmIndex = get().selectedRealmIndex;
      realmIndex = realmIndex === -1 ? 0 : ((realmIndex % realms.length) + realms.length) % realms.length;

      if (!get().realmOpen) {
        // advance realm (wrap realms only), reset map selection
        const nextRealm = (realmIndex + 1) % realms.length;
        set({ selectedRealmIndex: nextRealm, selectedMapIndex: 0 });
      } else {
        // inside a realm: do NOT wrap maps — next realm instead
        const maps = Object.keys(_dir[realms[realmIndex]]) ?? [];
        if (maps.length === 0) {
          set({ realmOpen: false, selectedRealmIndex: (realmIndex + 1) % realms.length });
          return;
        }
        const nextMap = get().selectedMapIndex + 1;
        if (nextMap >= maps.length) {
          // out of bounds → close realm, keep indices as-is
          set({ realmOpen: false });
        } else {
          set({ selectedMapIndex: nextMap });
        }
      }
    },

    previous: () => {
      const _dir = dir();
      const realms = !!_dir && Object.keys(_dir);

      // normalize current realm index
      let realmIndex = get().selectedRealmIndex;
      realmIndex = realmIndex === -1 ? 0 : ((realmIndex % realms.length) + realms.length) % realms.length;

      if (!get().realmOpen) {
        // go to previous realm (wrap realms only)
        const prevRealmIndex = (realmIndex - 1 + realms.length) % realms.length;
        set({ selectedRealmIndex: prevRealmIndex });
      } else {
        // inside a realm: do NOT wrap maps — close the realm instead
        const maps = Object.keys(_dir[realms[realmIndex]]);
        if (maps.length === 0) {
          set({ realmOpen: false });
          return;
        }
        const prevMap = get().selectedMapIndex - 1;
        if (prevMap < 0) {
          // out of bounds → close realm, keep indices as-is
          set({ realmOpen: false });
        } else {
          set({ selectedMapIndex: prevMap });
        }
      }
    },

    open: () => {
      if (!get().realmOpen) set({ realmOpen: true });
      else {
        get().ref.onOpenCallback?.();
        get().close(true);
      }
    },

    close: (fully) => {
      if (get().realmOpen && !fully) set({ realmOpen: false });
      else CALLOUT_SETTINGS.update({ browser: false });
    },

    ref: { onOpenCallback: () => void 0 },
  };
});