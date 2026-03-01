import { create } from "zustand";
import { RouterOuputs, trpcClient, useTRPC } from "./trpc";
import { useSubscription } from "@trpc/tanstack-react-query";
import { Mode1v1Manager } from "../../windows/main/mode-1v1/mode-1v1-manager";
import { MODE_1V1_THEME } from "../../windows/mode_1v1/mode_1v1-settings";

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

export const useConnectedClient = () => {
  const trpc = useTRPC();
  const loggedIn = useSession(state => !!state.session?.user);

  useSubscription(trpc.connectedClients.connect.subscriptionOptions(void 0, {
    enabled: loggedIn,
    onData: data => {
      if (data.type === 'theme') {
        Mode1v1Manager.Instance().saveTheme(data.data);
        MODE_1V1_THEME.update({ theme: data.data });
      }
    }
  }));
}
