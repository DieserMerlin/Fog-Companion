import { Add, Delete, Edit, ExpandMore, LinkOff, Link } from '@mui/icons-material';
import {
  Alert, Box, Button, Chip, Collapse, Divider, IconButton, InputAdornment,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { BACKGROUND_SETTINGS } from '../../../background/background-settings';
import { OBSManager } from '../../../background/obs/OBSManager';
import { OBS_SETTINGS } from '../../../background/obs/obs-settings';
import { OBS_STATUS, ObsConnectionStatus } from '../../../background/obs/obs-status';
import { ObsAutomation, ObsTriggerLabel } from '../../../background/obs/obs-types';
import { AppDB } from '../../../../utils/indexeddb/AppDB';
import { ObsAutomationEditor } from './ObsAutomationEditor';

const STATUS_COLOR: Record<ObsConnectionStatus, 'default' | 'warning' | 'success' | 'error'> = {
  disconnected: 'default',
  connecting: 'warning',
  connected: 'success',
  error: 'error',
};

const STATUS_LABEL: Record<ObsConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

function ActionSummary({ automation }: { automation: ObsAutomation }) {
  const labels = automation.actions.map(a => {
    if (a.type === 'SWITCH_SCENE') return `Switch Scene → ${a.scene || '?'}`;
    if (a.type === 'SET_PROFILE') return `Set Profile → ${a.profile || '?'}`;
    if (a.type === 'DELAY') return `Wait ${a.seconds}s`;
    return a.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  });
  return <Typography variant="caption" color="text.secondary">{labels.join(', ') || '—'}</Typography>;
}

export function ObsSettingsSection() {
  const status = OBS_STATUS.hook(s => s.status);
  const error = OBS_STATUS.hook(s => s.error);
  const settings = OBS_SETTINGS.hook();
  const smartFeatures = BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures);

  const automations = useLiveQuery(() => AppDB.obsAutomations.toArray(), []) ?? [];

  const [editTarget, setEditTarget] = useState<ObsAutomation | null | undefined>(undefined);
  const [guideOpen, setGuideOpen] = useState(false);
  const editorOpen = editTarget !== undefined;

  const handleConnect = () => {
    if (status === 'connected') {
      OBS_SETTINGS.update({ enabled: false });
      OBSManager.Instance().disconnect();
    } else {
      OBS_SETTINGS.update({ enabled: true });
      // connect() is called by the background settings subscriber
    }
  };

  const handleSave = async (data: Omit<ObsAutomation, 'id'>) => {
    if (editTarget?.id) {
      await AppDB.obsAutomations.put({ ...data, id: editTarget.id });
    } else {
      await AppDB.obsAutomations.add({ ...data, id: crypto.randomUUID() });
    }
    setEditTarget(undefined);
  };

  const handleDelete = async (id: string) => {
    await AppDB.obsAutomations.delete(id);
  };

  return (
    <Stack spacing={2}>
      {/* ── Smart Features warning ── */}
      {!smartFeatures && (
        <Alert severity="warning" sx={{ py: 0, fontSize: 12 }}>
          Smart Features are disabled. OBS automations will not fire until they are enabled.
        </Alert>
      )}

      {/* ── Setup guide ── */}
      <Stack spacing={0}>
        <Button
          size="small"
          variant="text"
          color="info"
          endIcon={<ExpandMore sx={{ transition: 'transform 0.2s', transform: guideOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />}
          onClick={() => setGuideOpen(o => !o)}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          How to set up OBS WebSocket
        </Button>
        <Collapse in={guideOpen}>
          <Alert severity="info" sx={{ mt: 1, fontSize: 12 }}>
            <Stack spacing={0.75}>
              <span><b>1.</b> Open OBS Studio.</span>
              <span><b>2.</b> Go to <b>Tools → WebSocket Server Settings</b>.</span>
              <span><b>3.</b> Check <b>Enable WebSocket server</b>.</span>
              <span><b>4.</b> Set your desired port (default <b>4455</b>) and optionally a password.</span>
              <span><b>5.</b> Click <b>OK</b>, then enter the same host/port/password below and click <b>Connect</b>.</span>
            </Stack>
          </Alert>
        </Collapse>
      </Stack>

      <Divider />

      {/* ── Connection ── */}
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="overline" sx={{ lineHeight: 1 }}>Connection</Typography>
          <Chip
            size="small"
            label={STATUS_LABEL[status]}
            color={STATUS_COLOR[status]}
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label="Host"
            value={settings.host}
            onChange={e => OBS_SETTINGS.update({ host: e.target.value })}
            sx={{ flex: 2 }}
          />
          <TextField
            size="small"
            label="Port"
            type="number"
            value={settings.port}
            onChange={e => OBS_SETTINGS.update({ port: Number(e.target.value) })}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Password"
            type="password"
            value={settings.password}
            onChange={e => OBS_SETTINGS.update({ password: e.target.value })}
            sx={{ flex: 2 }}
          />
        </Stack>

        {error && <Alert severity="error" sx={{ py: 0, fontSize: 12 }}>{error}</Alert>}

        <Box>
          <Button
            variant={status === 'connected' ? 'outlined' : 'contained'}
            color={status === 'connected' ? 'error' : 'primary'}
            size="small"
            startIcon={status === 'connected' ? <LinkOff /> : <Link />}
            onClick={handleConnect}
            disabled={status === 'connecting'}
          >
            {status === 'connected' ? 'Disconnect' : status === 'connecting' ? 'Connecting…' : 'Connect'}
          </Button>
        </Box>
      </Stack>

      <Divider />

      {/* ── Automations ── */}
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" sx={{ lineHeight: 1 }}>Automations</Typography>
          <Button size="small" startIcon={<Add />} onClick={() => setEditTarget(null)}>
            Add
          </Button>
        </Stack>

        {automations.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            No automations configured.
          </Typography>
        )}

        <Stack spacing={1}>
          {automations.map(automation => (
            <Stack
              key={automation.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1 }}
            >
              <Stack flex={1} spacing={0}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={600}>
                    {ObsTriggerLabel[automation.trigger]}
                  </Typography>
                </Stack>
                <ActionSummary automation={automation} />
              </Stack>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => setEditTarget(automation)}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => handleDelete(automation.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      </Stack>

      <ObsAutomationEditor
        open={editorOpen}
        initial={editTarget}
        onSave={handleSave}
        onClose={() => setEditTarget(undefined)}
      />
    </Stack>
  );
}
