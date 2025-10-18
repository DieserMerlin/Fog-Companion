import { create } from "zustand";
import { MapResolver } from "../../../game_state/GameState";

export const useMapDir = create<{ realms: Record<string, Record<string, number>>, update: (refresh: boolean) => void }>((set) => ({
  realms: {},
  update: async (refresh: boolean) => {
    if (refresh) await MapResolver.Instance().reloadCache();
    set({ realms: MapResolver.Instance().countsByRealm() });
  }
}));

useMapDir.getState().update(false);
