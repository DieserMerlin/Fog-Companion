import { Add, InfoOutlined } from '@mui/icons-material';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, MenuItem, Select, Stack, Tooltip, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { OBSManager } from '../../../background/obs/OBSManager';
import { ObsAction, ObsActionType, ObsAutomation, ObsTrigger, ObsTriggerLabel, ObsTriggerVisible } from '../../../background/obs/obs-types';
import { OBS_STATUS } from '../../../background/obs/obs-status';
import { ObsActionRow } from './ObsActionRow';

type Props = {
  initial?: ObsAutomation | null;
  open: boolean;
  onSave: (automation: Omit<ObsAutomation, 'id'>) => void;
  onClose: () => void;
};

export function ObsAutomationEditor({ initial, open, onSave, onClose }: Props) {
  const [trigger, setTrigger] = useState<ObsTrigger>(ObsTrigger.TO_MATCH);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [actions, setActions] = useState<ObsAction[]>([]);
  const [scenes, setScenes] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);

  const connected = OBS_STATUS.hook(s => s.status === 'connected');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTrigger(initial.trigger);
      setVerifiedOnly(initial.verifiedOnly);
      setActions(initial.actions);
    } else {
      setTrigger(ObsTrigger.TO_MATCH);
      setVerifiedOnly(true);
      setActions([]);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open || !connected) return;
    const obs = OBSManager.Instance();
    obs.getScenes().then(setScenes);
    obs.getProfiles().then(setProfiles);
  }, [open, connected]);

  const addAction = () => setActions(a => [...a, { type: ObsActionType.SWITCH_SCENE, scene: '' }]);
  const updateAction = (i: number, action: ObsAction) =>
    setActions(a => a.map((x, idx) => idx === i ? action : x));
  const deleteAction = (i: number) =>
    setActions(a => a.filter((_, idx) => idx !== i));

  const handleSave = () => {
    onSave({ trigger, verifiedOnly, actions });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Automation' : 'New Automation'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">Trigger</Typography>
            <Select
              size="small"
              value={trigger}
              onChange={e => setTrigger(e.target.value as ObsTrigger)}
              fullWidth
            >
              {ObsTriggerVisible.map(t => (
                <MenuItem key={t} value={t}>{ObsTriggerLabel[t]}</MenuItem>
              ))}
            </Select>
          </Stack>

          {(trigger === ObsTrigger.TO_MATCH || trigger === ObsTrigger.FROM_MATCH) && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <FormControlLabel
                control={<Checkbox checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} />}
                label="Only on verified match (map detected)"
              />
              <Tooltip title="Verified means a map name was recognised by OCR. Recommended — avoids false triggers caused by fallback detection or loading screen transitions." arrow>
                <InfoOutlined fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
              </Tooltip>
            </Stack>
          )}

          <Divider />

          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Actions</Typography>
              <Button size="small" startIcon={<Add />} onClick={addAction}>Add action</Button>
            </Stack>

            {actions.length === 0 && (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                No actions yet — add at least one.
              </Typography>
            )}

            {actions.map((action, i) => (
              <ObsActionRow
                key={i}
                action={action}
                scenes={scenes}
                profiles={profiles}
                onChange={a => updateAction(i, a)}
                onDelete={() => deleteAction(i)}
              />
            ))}

            {!connected && actions.some(a =>
              a.type === ObsActionType.SWITCH_SCENE || a.type === ObsActionType.SET_PROFILE
            ) && (
              <Alert severity="info" sx={{ fontSize: 12 }}>
                Connect to OBS to pick scenes and profiles from a dropdown.
              </Alert>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={actions.length === 0}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
