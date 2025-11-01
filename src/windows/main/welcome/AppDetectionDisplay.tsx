import Paper from "@mui/material/Paper";
import { useGameState } from "../../../utils/hooks/gamestate-hook"
import { BACKGROUND_SETTINGS } from "../../background/background-settings";
import Stack from "@mui/material/Stack";
import { DetectionCause, GameStateType } from "../../../game_state/GameState";
import { TipsAndUpdates } from "@mui/icons-material";
import { useRef } from "react";
import { KillerDetectionCertainty } from "../../../game_state/DetectableKillers";

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
  KILLER_NAME_TEXT: 'Killer Name text',
  FALLBACK: 'Last detection > x seconds'
}

const HumanReadableCertainty: { [key in KillerDetectionCertainty]: { color: string, text: string } } = {
  [KillerDetectionCertainty.BLIND_GUESS]: { color: "#9c4343ff", text: "Blind guess" },
  [KillerDetectionCertainty.UNCERTAIN]: { color: "#bd8c4dff", text: "Uncertain" },
  [KillerDetectionCertainty.CERTAIN]: { color: "#c5bf6cff", text: "Fairly certain" },
  [KillerDetectionCertainty.CONFIRMED]: { color: "#70c770ff", text: "Very certain" }
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
    <Stack direction={'row'} spacing={1} alignItems={'center'} width={'100%'}>
      <Paper variant="outlined" style={{ opacity: .6, width: '50%' }}>
        <Stack direction={'row'} alignItems={'center'} spacing={1} py={.5} px={1} height={40}>
          <TipsAndUpdates onClick={handleClick} />
          {smartDetection ? (
            <Stack spacing={-.5} justifyContent={'center'}>
              <span style={{ fontSize: 13 }}>State: <b>{(HumanReadableGameState[gs.type] || gs.type)}</b></span>
              {!!gs.detectedBy && <span style={{ fontSize: 11 }}>Guess based on: <b>{(HumanReadableDetectionCause[gs.detectedBy] || gs.detectedBy)}</b></span>}
              {!gs.detectedBy && gs.type === GameStateType.UNKNOWN && <span style={{ fontSize: 11 }}>Open menu to continue detection.</span>}
              {!gs.detectedBy && gs.type === GameStateType.CLOSED && <span style={{ fontSize: 11 }}>Open DBD to start detection.</span>}
            </Stack>
          ) : (
            <small>Enable to start guessing.</small>
          )}
        </Stack>
      </Paper >
      <Paper variant="outlined" style={{ opacity: .6, width: '50%' }}>
        <Stack direction={'row'} alignItems={'center'} spacing={1} py={.5} px={1} height={40}>
          <span>🔪</span>
          <Stack spacing={-.5} justifyContent={'center'}>
            <span style={{ fontSize: 13 }}>Killer: <b>{(gs.killer?.name || gs.killerGuess || 'No guess')}</b></span>
            {!!gs.killer && <span style={{ fontSize: 11 }}>Guess certainty: <b style={{ color: HumanReadableCertainty[gs.killer.certainty].color }}>{HumanReadableCertainty[gs.killer.certainty].text}</b></span>}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  )
}