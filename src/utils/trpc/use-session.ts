import { create } from "zustand";
import { RouterOuputs, trpcClient } from "./trpc";

type Session = RouterOuputs['sessions']['current'];

export const useSession = create<{ session: Session | null, recheck: () => void }>(set => {
  const recheck = async () => {
    try {
      const data = await trpcClient().sessions.current.query();
      set({ session: data });
    } catch (e) {
      console.error(e);
    }
  };

  window.addEventListener('DOMContentLoaded', recheck)
  setInterval(recheck, 60 * 1000);

  return {
    session: null,
    recheck
  }
});
