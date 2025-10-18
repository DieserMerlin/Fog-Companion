import { create } from "zustand";
import { MapResolver } from "../../../game_state/GameState";

export const useMapDir = create<{ realms: Record<string, Record<string, number>>, update: (refresh: boolean) => void }>((set) => ({
  realms: {},
  update: async (refresh: boolean) => {
    if (refresh) await MapResolver.reloadCache();
    set({ realms: MapResolver.countsByRealm() });
  }
}));

useMapDir.getState().update(false);
