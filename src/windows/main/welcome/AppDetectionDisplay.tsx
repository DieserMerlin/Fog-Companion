import { Settings, TipsAndUpdates, Videocam } from "@mui/icons-material";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { HumanReadableCertainty } from '@diesermerlin/fog-companion-web';
import { useRef } from "react";
import { DetectionCause, GameStateType } from "../../../game_state/GameState";
import { useGameState } from "../../../utils/hooks/gamestate-hook";
import { BACKGROUND_SETTINGS } from "../../background/background-settings";
import { OBSManager } from "../../background/obs/OBSManager";
import { OBS_SETTINGS } from "../../background/obs/obs-settings";
import { OBS_STATUS, ObsConnectionStatus } from "../../background/obs/obs-status";
import { useRecording } from "../recording/recording-store";
import { AppSettingsSection, useAppSettings } from "../settings/use-app-settings";
import { MainAppTab, useMainApp } from "../use-main-app";
import { HLTElement } from "./tutorials/AppHighlightTutorial";
import { HomeViewTutorial } from "./tutorials/highlight/HomeViewTutorial";

const INDICATOR_HEIGHT = 36;
const INDICATOR_PY = 0.375;

const twoLineStyle: React.CSSProperties = {
  overflow: 'hidden',
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  justifyContent: 'center',
};

const line1Style: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.35,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const line2Style: React.CSSProperties = {
  fontSize: 10,
  opacity: .7,
  lineHeight: 1.35,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function StatusDot({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: color,
      boxShadow: glow ? `0 0 4px ${color}` : 'none',
    }} />
  );
}

// ── Shared dot color palette ───────────────────────────────────────────────

const DOT_OFF    = '#555';
const DOT_WARN   = '#f59e0b';
const DOT_OK     = '#22c55e';
const DOT_ACTIVE = '#3b82f6';
const DOT_ERROR  = '#ef4444';

// ── OBS indicator ──────────────────────────────────────────────────────────

const OBS_DOT_COLOR: Record<ObsConnectionStatus, string> = {
  disconnected: DOT_ERROR,
  connecting:   DOT_WARN,
  connected:    DOT_OK,
  error:        DOT_ERROR,
};

const OBS_STATUS_LABEL: Record<ObsConnectionStatus, string> = {
  disconnected: 'Not connected',
  connecting:   'Connecting…',
  connected:    'Connected',
  error:        'Error',
};

function ObsIndicator({ setRef }: { setRef?: (el: HTMLElement | null) => void }) {
  const status  = OBS_STATUS.hook(s => s.status);
  const error   = OBS_STATUS.hook(s => s.error);
  const enabled = OBS_SETTINGS.hook(s => s.enabled);
  const smartFeatures = BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures);
  const unavailable = !smartFeatures;

  const dotColor    = unavailable || !enabled ? DOT_OFF : OBS_DOT_COLOR[status];
  const statusLabel = unavailable ? 'Requires Smart Features'
    : !enabled ? 'Disabled'
    : OBS_STATUS_LABEL[status];
  const toggleLabel = unavailable
    ? 'Enable Smart Features to use OBS Automation'
    : enabled ? 'Click to disable OBS Automation' : 'Click to enable OBS Automation';
  const tooltipTitle = !unavailable && error ? `OBS Error: ${error} — ${toggleLabel}` : toggleLabel;

  const handleToggle = () => {
    if (unavailable) return;
    if (enabled) {
      OBS_SETTINGS.update({ enabled: false });
      OBSManager.Instance().disconnect();
    } else {
      OBS_SETTINGS.update({ enabled: true });
    }
  };

  const openSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    useMainApp.setState({ tab: MainAppTab.SETTINGS });
    useAppSettings.setState({ expand: AppSettingsSection.OBS });
  };

  return (
    <Tooltip title={tooltipTitle} arrow>
      <Paper
        ref={setRef}
        variant="outlined"
        onClick={handleToggle}
        style={{ opacity: .6, cursor: unavailable ? 'default' : 'pointer', width: '100%' }}
      >
        <Stack direction="row" alignItems="center" spacing={1} py={INDICATOR_PY} px={1} height={INDICATOR_HEIGHT}>
          <Videocam style={{ fontSize: 16, flexShrink: 0 }} />
          <div style={twoLineStyle}>
            <span style={line1Style}>OBS Automation</span>
            <span style={line2Style}>{statusLabel}</span>
          </div>
          <Tooltip title="Open OBS Settings" arrow>
            <IconButton size="small" onClick={openSettings} style={{ padding: 2, flexShrink: 0 }}>
              <Settings style={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <StatusDot color={dotColor} glow={!unavailable && enabled && status === 'connected'} />
        </Stack>
      </Paper>
    </Tooltip>
  );
}

// ── Detection indicators ───────────────────────────────────────────────────

const HumanReadableGameState: { [key in GameStateType]: string } = {
  CLOSED:  'Closed',
  LOADING: 'Loading Screen',
  MATCH:   'In Match',
  MENU:    'In Menu',
  UNKNOWN: 'Unknown',
};

const HumanReadableDetectionCause: { [key in DetectionCause]: string } = {
  BLACK_EDGES:      'Black edges',
  LOADING_TEXT:     'Loading text',
  MAIN_MENU_TEXT:   'Main menu texts',
  MAP_TEXT:         'Map text',
  MENU_BUTTON_TEXT: 'Menu button',
  BLOODPOINTS_TEXT: 'Bloodpoints',
  SETTINGS_TEXT:    'Settings texts',
  KILLER_POWER_TEXT:'Killer Power text',
  KILLER_NAME_TEXT: 'Killer Name text',
  FALLBACK:         'Fallback',
};

const STATE_DOT_COLOR: { [key in GameStateType]: string } = {
  CLOSED:  DOT_OFF,
  UNKNOWN: DOT_WARN,
  LOADING: DOT_WARN,
  MENU:    DOT_ACTIVE,
  MATCH:   DOT_OK,
};

export const AppDetectionDisplay = () => {
  const gs              = useGameState().state;
  const smartDetection  = BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures);
  const killerDetection = BACKGROUND_SETTINGS.hook(s => s.enableKillerDetection);
  const smartDisabled   = !smartDetection;

  const toggleDebug = () => BACKGROUND_SETTINGS.update({ enableOcrDebug: !BACKGROUND_SETTINGS.getValue().enableOcrDebug });
  const toggleKillerDetection = () => {
    if (!smartDisabled) BACKGROUND_SETTINGS.update({ enableKillerDetection: !killerDetection });
  };

  const clickRef      = useRef<{ count: number, lastClick: number }>({ count: 0, lastClick: 0 });
  const stateClickRef = useRef<{ count: number, lastClick: number }>({ count: 0, lastClick: 0 });

  const handleClick = () => {
    if (Date.now() - clickRef.current.lastClick < 300) clickRef.current.count++;
    else clickRef.current.count = 1;
    clickRef.current.lastClick = Date.now();
    if (clickRef.current.count >= 3) { toggleDebug(); clickRef.current.count = 0; }
  };

  const handleStateClick = () => {
    if (Date.now() - stateClickRef.current.lastClick < 300) stateClickRef.current.count++;
    else stateClickRef.current.count = 1;
    stateClickRef.current.lastClick = Date.now();
    if (stateClickRef.current.count >= 3) { useRecording.setState({ open: true }); stateClickRef.current.count = 0; }
  };

  // ── State indicator values ─────────────────────────────────────────────
  const stateDotColor = smartDisabled ? DOT_OFF : STATE_DOT_COLOR[gs.type];
  const stateTitle    = smartDisabled
    ? 'Disabled'
    : (gs.type === GameStateType.MATCH && gs.map ? `Match (${gs.map.name})` : HumanReadableGameState[gs.type] || gs.type);
  const stateSub      = smartDisabled
    ? 'Smart Features off'
    : gs.detectedBy ? `By: ${HumanReadableDetectionCause[gs.detectedBy] || gs.detectedBy}`
    : gs.type === GameStateType.UNKNOWN ? 'Open menu to continue.'
    : gs.type === GameStateType.CLOSED  ? 'Open DBD to start.'
    : null;

  // ── Killer indicator values ────────────────────────────────────────────
  const killerName    = gs.killer?.name || gs.killerGuess || 'No guess';
  const killerActive  = smartDetection && killerDetection;
  const gameOpen      = gs.type !== GameStateType.CLOSED && gs.type !== GameStateType.UNKNOWN;
  const killerDotColor = !killerActive ? DOT_OFF
    : gs.killer ? (HumanReadableCertainty[gs.killer.certainty].color ?? DOT_OK)
    : gameOpen ? DOT_WARN
    : DOT_OFF;
  const killerSub     = smartDisabled ? 'Smart Features off'
    : !killerDetection ? 'Detection off'
    : !gameOpen ? 'Game not open'
    : gs.killer ? HumanReadableCertainty[gs.killer.certainty].text
    : 'Detecting…';

  const killerTooltip = smartDisabled
    ? 'Enable Smart Features to use killer detection'
    : killerDetection
      ? 'Killer detection on — click to disable'
      : 'Killer detection off — click to enable';

  return (
    <Stack direction={'column'} spacing={.5} width={'100%'}>
      <Stack direction={'row'} spacing={.5} alignItems={'stretch'}>

        {/* ── State ── */}
        <HLTElement {...HomeViewTutorial.SmartFeaturesState}>
          {(key, setRef) => (
            <Paper ref={setRef} key={key} variant="outlined" style={{ opacity: .6, flex: 1, minWidth: 0 }}>
              <Stack direction={'row'} alignItems={'center'} spacing={1} py={INDICATOR_PY} px={1} height={INDICATOR_HEIGHT}>
                <TipsAndUpdates onClick={handleClick} style={{ fontSize: 16, flexShrink: 0 }} />
                <div style={twoLineStyle} onClick={handleStateClick}>
                  <span style={line1Style}>State: <b>{stateTitle}</b></span>
                  {stateSub && <span style={line2Style}>{stateSub}</span>}
                </div>
                <StatusDot color={stateDotColor} glow={stateDotColor === DOT_OK || stateDotColor === DOT_ACTIVE} />
              </Stack>
            </Paper>
          )}
        </HLTElement>

        {/* ── Killer ── */}
        <HLTElement {...HomeViewTutorial.SmartFeaturesKiller}>
          {(key, setRef) => (
            <Tooltip title={killerTooltip} arrow>
              <Paper
                key={key}
                ref={setRef}
                variant="outlined"
                onClick={toggleKillerDetection}
                style={{ opacity: .6, flex: 1, minWidth: 0, cursor: smartDisabled ? 'default' : 'pointer' }}
              >
                <Stack direction={'row'} alignItems={'center'} spacing={1} py={INDICATOR_PY} px={1} height={INDICATOR_HEIGHT}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🔪</span>
                  <div style={twoLineStyle}>
                    <span style={line1Style}>Killer: <b>{killerName}</b></span>
                    <span style={line2Style}>{killerSub}</span>
                  </div>
                  <StatusDot color={killerDotColor} glow={killerDotColor === DOT_OK} />
                </Stack>
              </Paper>
            </Tooltip>
          )}
        </HLTElement>

      </Stack>

      <HLTElement {...HomeViewTutorial.ObsIndicator}>
        {(key, setRef) => <ObsIndicator key={key} setRef={setRef} />}
      </HLTElement>
    </Stack>
  );
};
