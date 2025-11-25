import { Mode1v1TimerState } from "@diesermerlin/fog-companion-web";
import { createStorage } from "../../utils/localstorage/typed-localstorage";
import { BACKGROUND_SETTINGS } from "../background/background-settings";

export const MODE_1V1_STATE = createStorage<{ state: Mode1v1TimerState | null }>('MODE_1V1_STATE', { state: null });

export const useMode1v1State = MODE_1V1_STATE.hook;

BACKGROUND_SETTINGS.hook.subscribe(s => {
  if (s.mode !== '1v1') MODE_1V1_STATE.update({ state: null });
});
if (
  BACKGROUND_SETTINGS.getValue().mode !== '1v1' ||
  !overwolf.windows.getMainWindow().gameInfo?.isRunning
) MODE_1V1_STATE.update({ state: null });
