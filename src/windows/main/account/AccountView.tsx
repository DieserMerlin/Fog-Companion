import { AuthProvider } from "@diesermerlin/fog-companion-web";
import { ArrowForwardIos, Logout, Person, Sync } from "@mui/icons-material";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useMutation } from '@tanstack/react-query';
import { memo, useRef, useState } from "react";
import { APP_CONFIG } from "../../../AppConfig";
import { ConfirmOpenLinkExternally } from "../../../utils/mui/OverwolfLink";
import { useTRPC } from "../../../utils/trpc/trpc";
import { useSession } from "../../../utils/trpc/use-session";
import { WIP } from "../../../utils/WIP";
import { ACCOUNT_SETTINGS } from "./account-settings";

const ProfileImg = memo((props: { width: number, provider: AuthProvider, providerUserId: string, avatar?: string }) => {
  const getUrl = () => {
    switch (props.provider) {
      case 'DISCORD':
        return `https://cdn.discordapp.com/avatars/${props.providerUserId}/${props.avatar}`;
    }
    return null;
  }

  if (!props.avatar) return <Person style={{ width: props.width, height: props.width }} />
  return <div style={{ background: `url(${getUrl()})`, width: props.width, height: props.width, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', borderRadius: 999999 }} />
});

const SyncIntervals = {
  [10_000]: '10 seconds',
  [30_000]: '30 seconds',
  [60_000]: 'minute',
  [120_000]: '2 minutes',
  [300_000]: '5 minutes',
} as const;

export const AccountView = () => {
  const session = useSession(s => s.session!);

  const trpc = useTRPC();
  const { mutate: logout } = useMutation(trpc.sessions.logout.mutationOptions({ onSuccess: () => useSession.getState().recheck() }));

  const sync = ACCOUNT_SETTINGS.hook(s => s.sync1v1Challenges);
  let syncInterval = ACCOUNT_SETTINGS.hook(s => s.sync1v1Interval);
  if (!SyncIntervals[syncInterval]) syncInterval = 10_000;

  const linkRef = useRef<HTMLAnchorElement>(null);
  const [syncIntOpen, setSyncIntOpen] = useState(false);

  return (
    <Stack width={'100%'} spacing={1}>
      <Paper sx={{ p: 2 }} variant="outlined">
        <Stack direction={'row'} spacing={1} alignItems={'center'} width={'100%'}>
          <ProfileImg width={80} provider={session.user.mainProvider} providerUserId={session.user.mainAuth.providerUserId} avatar={session.user.mainAuth.avatar} />
          <Stack>
            <Typography variant="h5">{session.user.mainAuth.displayName || session.user.mainAuth.username}</Typography>
            <Typography variant="body1">@{session.user.mainAuth.username}</Typography>
            <small>Logged in using <b>{session.user.mainProvider}</b></small>
          </Stack>
          <span style={{ flexGrow: 1 }} />
          <Stack spacing={.5}>
            <ConfirmOpenLinkExternally href={APP_CONFIG.BACKEND_URL}>
              <Button variant="outlined" color="info" endIcon={<ArrowForwardIos />}>Open Fog Companion Web</Button>
            </ConfirmOpenLinkExternally>
            <Button onClick={() => logout()} variant="outlined" color="error" endIcon={<Logout />}>Logout</Button>
          </Stack>
        </Stack>
      </Paper>
      <Paper>
        <Stack p={1} spacing={1} direction={'row'} alignItems={'center'}>
          <Sync />
          <Stack flexGrow={1} spacing={-.2}>
            <Typography variant="body1">
              Sync 1v1 Challenges/Chases
            </Typography>
            <small>
              Enable this so Fog Companion can track your 1v1 Statistics!
            </small>
          </Stack>
          <Stack alignItems={'end'}>
            <Switch checked={sync} onChange={(_, c) => ACCOUNT_SETTINGS.update({ sync1v1Challenges: c })} />
            <small>Sync every <b><Link onClick={() => setSyncIntOpen(true)} ref={linkRef}>{SyncIntervals[syncInterval]}</Link></b>.</small>
            <Menu open={syncIntOpen} onClose={() => setSyncIntOpen(false)} anchorEl={linkRef.current}>
              {Object.keys(SyncIntervals).map((k) => (
                <MenuItem sx={t => ({ color: syncInterval === parseInt(k) ? t.palette.primary.main : undefined })} onClick={() => { ACCOUNT_SETTINGS.update({ sync1v1Interval: parseInt(k) }); setSyncIntOpen(false); }}>{SyncIntervals[parseInt(k)]}</MenuItem>
              ))}
            </Menu>
          </Stack>
        </Stack>
      </Paper>
      <WIP />
    </Stack>
  );
}