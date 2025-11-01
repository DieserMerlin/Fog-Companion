import Paper from "@mui/material/Paper";
import { useGameState } from "../../../utils/hooks/gamestate-hook"
import { BACKGROUND_SETTINGS } from "../../background/background-settings";
import Stack from "@mui/material/Stack";
import { DetectionCause, GameStateType } from "../../../game_state/GameState";
import { TipsAndUpdates } from "@mui/icons-material";
import { useRef } from "react";

const HumanReadableGameState: { [key in GameStateType]: string } = ({
  CLOSED: "Closed",
  LOADING: "Loading Screen",
  MATCH: "In Match",
  MENU: "In Menu",
  UNKNOWN: "Unknown"
});

const HumanReadableDetectionCause: { [key in DetectionCause]: string } = {
  BLACK_EDGES: 'Black edges',
  LOADING_TEXT: 'Loading text',
  MAIN_MENU_TEXT: 'Main menu texts',
  MAP_TEXT: 'Map text',
  MENU_BUTTON_TEXT: 'Menu button',
  BLOODPOINTS_TEXT: 'Bloodpoints',
  SETTINGS_TEXT: 'Settings texts',
  KILLER_POWER_TEXT: 'Killer Power text',
  FALLBACK: 'Last detection > x seconds'
}

export const AppDetectionDisplay = () => {
  const gs = useGameState().state;
  const smartDetection = BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures);

  const toggleDebug = () => BACKGROUND_SETTINGS.update({ enableOcrDebug: !BACKGROUND_SETTINGS.getValue().enableOcrDebug });

  const clickRef = useRef<{ count: number, lastClick: number }>({ count: 0, lastClick: 0 });

  const handleClick = () => {
    if (Date.now() - clickRef.current.lastClick < 300) clickRef.current.count++;
    else clickRef.current.count = 1;
    clickRef.current.lastClick = Date.now();

    if (clickRef.current.count >= 3) {
      toggleDebug();
      clickRef.current.count = 0;
    }
  }

  return (
    <Paper variant="outlined" style={{ opacity: .6 }}>
      <Stack direction={'row'} alignItems={'center'} spacing={1} py={.5} px={1} height={44}>
        <TipsAndUpdates onClick={handleClick} />
        {smartDetection ? (
          <Stack>
            <span style={{ fontSize: 13 }}>Guess: <b>{(HumanReadableGameState[gs.type] || gs.type)?.toUpperCase()}</b></span>
            {!!gs.detectedBy && <span style={{ fontSize: 11 }}>Based on: <b>{(HumanReadableDetectionCause[gs.detectedBy] || gs.detectedBy)?.toUpperCase()}</b></span>}
            {!gs.detectedBy && gs.type === GameStateType.UNKNOWN && <span style={{ fontSize: 11 }}>Open menu to continue detection.</span>}
            {!gs.detectedBy && gs.type === GameStateType.CLOSED && <span style={{ fontSize: 11 }}>Open DBD to start detection.</span>}
          </Stack>
        ) : (
          <small>Enable to start guessing.</small>
        )}
      </Stack>
    </Paper >
  )
}