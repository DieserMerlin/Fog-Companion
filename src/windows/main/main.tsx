import { createRoot } from 'react-dom/client';
import { AppWindow } from "../../AppWindow";
import { kWindowNames } from "../../consts";
import { IngameApp } from "./MainApp";
import { useMainApp } from './use-main-app';

const FIRST_MOVE_KEY = 'movedToSecondScreen';

function getMonitors(): Promise<overwolf.utils.getMonitorsListResult> {
  return new Promise(res => overwolf.utils.getMonitorsList(res));
}
function getCurrentWin(): Promise<overwolf.windows.WindowInfo> {
  return new Promise(res => overwolf.windows.getCurrentWindow(r => res(r.window)));
}
function restore(id: string) { overwolf.windows.restore(id); }
function move(id: string, x: number, y: number) { overwolf.windows.changePosition(id, x, y); }

const handleVal = (h: any) => (h && typeof h === 'object') ? h.value : h;

async function moveOnceToSecondScreen(gameInfo: overwolf.games.RunningGameInfo) {
  if (!gameInfo?.isRunning /* || !gameInfo.isInFocus */) return; // focus not required

  if (localStorage.getItem(FIRST_MOVE_KEY) === '1') return;

  const { success, displays = [] } = await getMonitors();
  if (!success || displays.length < 2) return;

  const gameHandleValue = handleVal(gameInfo.monitorHandle);

  // Prefer any monitor whose handle.value != game's handle.value; fallback to any non-primary
  let target = displays.find(d => handleVal(d.handle) !== gameHandleValue)
    || displays.find(d => !d.is_primary);
  if (!target) return;

  const win = await getCurrentWin();

  // Make sure it's restored before moving
  restore(win.id);

  const inset = 60;
  const targetX = (target.x ?? 0) + inset;
  const targetY = (target.y ?? 0) + inset;

  move(win.id, targetX, targetY);

  // Optional: nudge Z-order without stealing focus (on the other monitor it will be visible anyway)
  // overwolf.windows.bringToFront(win.id); // do NOT pass grabFocus on fullscreen games. :contentReference[oaicite:1]{index=1}

  localStorage.setItem(FIRST_MOVE_KEY, '1');
}

class MainWindow extends AppWindow {
  private static _instances: { [key: string]: MainWindow } = {};

  private constructor(windowName: kWindowNames) {
    super(windowName);
    console.log(windowName);

    if (windowName === kWindowNames.mainDesktop)
      overwolf.windows.getMainWindow().bus.on('game-info', gi => !!gi && moveOnceToSecondScreen(gi));
  }

  public static instance(windowName: kWindowNames) {
    if (!this._instances[windowName]) this._instances[windowName] = new MainWindow(windowName);
    return this._instances[windowName];
  }
}

new Promise<boolean>(res => overwolf.windows.getCurrentWindow(_res => res(_res.window.name === kWindowNames.mainDesktop))).then(res => {
  console.log(res ? 'DESKTOP' : 'INGAME');
  MainWindow.instance(res ? kWindowNames.mainDesktop : kWindowNames.mainInGame);
  useMainApp.setState({ mode: res ? 'desktop' : 'in-game' })
});

const root = createRoot(document.getElementById('root')!);
root.render(<IngameApp />);
