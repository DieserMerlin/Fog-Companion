import { create } from "zustand";
import { RouterOuputs, trpcClient, useTRPC } from "./trpc";
import { useSubscription } from "@trpc/tanstack-react-query";
import { Mode1v1Manager } from "../../windows/main/mode-1v1/mode-1v1-manager";
import { MODE_1V1_THEME } from "../../windows/mode_1v1/mode_1v1-settings";

type Session = RouterOuputs['sessions']['current'];

const isBackgroundWindow = () => window.location.pathname.toLowerCase().includes('background');

const getMainWindow = () => overwolf.windows.getMainWindow() as Window & {
  cache?: Record<string, unknown>;
  bus?: {
    on?: (event: string, callback: (payload?: unknown) => void) => void;
    emit?: (event: string, payload?: unknown) => void;
  };
};

export const useSession = create<{ session: Session | null, recheck: () => void }>(set => {
  const mainWindow = getMainWindow();
  const initialSession = (mainWindow.cache?.sessionSnapshot as Session | null | undefined) || null;
  const recheck = async () => {
    try {
      const data = await trpcClient().sessions.current.query();
      set({ session: data });
      if (mainWindow.cache) mainWindow.cache.sessionSnapshot = data;
      mainWindow.bus?.emit?.('session-updated', data);
    } catch (e) {
      console.error(e);
    }
  };

  mainWindow.bus?.on?.('session-updated', payload => set({ session: (payload as Session | null) || null }));

  if (isBackgroundWindow()) {
    mainWindow.bus?.on?.('session-recheck', () => recheck());
    recheck();
    setInterval(recheck, 60 * 1000);
  } else {
    mainWindow.bus?.emit?.('session-recheck');
  }

  return {
    session: initialSession,
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
