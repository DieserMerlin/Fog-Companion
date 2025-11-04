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

  recheck();
  setInterval(recheck, 1000 * 60);

  return {
    session: null,
    recheck
  }
});
