import { Delete } from '@mui/icons-material';
import { IconButton, MenuItem, Select, Stack, TextField } from '@mui/material';
import { ObsAction, ObsActionLabel, ObsActionType, ObsActionTypeVisible } from '../../../background/obs/obs-types';

const ACTIONS_WITH_TARGET = [ObsActionType.SWITCH_SCENE, ObsActionType.SET_PROFILE, ObsActionType.DELAY];

type Props = {
  action: ObsAction;
  scenes: string[];
  profiles: string[];
  onChange: (action: ObsAction) => void;
  onDelete: () => void;
};

export function ObsActionRow({ action, scenes, profiles, onChange, onDelete }: Props) {
  const handleTypeChange = (type: ObsActionType) => {
    if (type === ObsActionType.SWITCH_SCENE) onChange({ type, scene: '' });
    else if (type === ObsActionType.SET_PROFILE) onChange({ type, profile: '' });
    else if (type === ObsActionType.DELAY) onChange({ type, seconds: 5 });
    else onChange({ type } as ObsAction);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Select
        size="small"
        value={action.type}
        onChange={e => handleTypeChange(e.target.value as ObsActionType)}
        sx={{ minWidth: 190 }}
      >
        {ObsActionTypeVisible.map(t => (
          <MenuItem key={t} value={t}>{ObsActionLabel[t]}</MenuItem>
        ))}
      </Select>

      {action.type === ObsActionType.SWITCH_SCENE && (
        scenes.length > 0 ? (
          <Select
            size="small"
            value={action.scene}
            onChange={e => onChange({ ...action, scene: e.target.value })}
            sx={{ flex: 1 }}
            displayEmpty
          >
            <MenuItem value="" disabled><em>Select scene</em></MenuItem>
            {scenes.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        ) : (
          <TextField
            size="small"
            placeholder="Scene name"
            value={action.scene}
            onChange={e => onChange({ ...action, scene: e.target.value })}
            sx={{ flex: 1 }}
          />
        )
      )}

      {action.type === ObsActionType.SET_PROFILE && (
        profiles.length > 0 ? (
          <Select
            size="small"
            value={action.profile}
            onChange={e => onChange({ ...action, profile: e.target.value })}
            sx={{ flex: 1 }}
            displayEmpty
          >
            <MenuItem value="" disabled><em>Select profile</em></MenuItem>
            {profiles.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        ) : (
          <TextField
            size="small"
            placeholder="Profile name"
            value={action.profile}
            onChange={e => onChange({ ...action, profile: e.target.value })}
            sx={{ flex: 1 }}
          />
        )
      )}

      {action.type === ObsActionType.DELAY && (
        <TextField
          size="small"
          type="number"
          label="Seconds"
          value={action.seconds}
          onChange={e => onChange({ ...action, seconds: Math.max(0, Number(e.target.value)) })}
          slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
          sx={{ width: 110 }}
        />
      )}

      {!ACTIONS_WITH_TARGET.includes(action.type) && <Stack flex={1} />}

      <IconButton size="small" onClick={onDelete}><Delete fontSize="small" /></IconButton>
    </Stack>
  );
}
