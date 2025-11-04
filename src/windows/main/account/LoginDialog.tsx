import { Login, Undo } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { skipToken, useMutation } from "@tanstack/react-query";
import { useSubscription } from '@trpc/tanstack-react-query';
import { PropsWithChildren, useState } from "react";
import { useTRPC } from "../../../utils/trpc/trpc";
import { useSession } from "../../../utils/trpc/use-session";
import { MainAppTab, useMainApp } from "../use-main-app";

export const LoginDialogWrapper = (props: PropsWithChildren<{ onClose: () => void }>) => {
  const trpc = useTRPC();

  const loggedIn = useSession(s => !!s.session?.user);
  const tabOpen = useMainApp(s => s.tab === MainAppTab.ACCOUNT);

  const open = !loggedIn && tabOpen;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  console.log({ loggedIn });
  const { mutate } = useMutation(trpc.sessions.getOverwolfSession.mutationOptions({ onSuccess: () => useSession.getState().recheck() }));
  const { data, status, reset } = useSubscription(trpc.sessions.overwolfLogin.subscriptionOptions(loggedIn ? skipToken : void 0, {
    onConnectionStateChange: opts => {
      setCode("");
      setError("");
    },
    onData: data => {
      'code' in data && setCode(data.code);
      data.success === true && mutate(data.jwt);
      data.success === false && setError("Connection failed. Please try again.");
    },
    onError: e => {
      setError(e.message);
    }
  }));

  const { mutate: logout } = useMutation(trpc.sessions.logout.mutationOptions({ onSuccess: () => useSession.getState().recheck() }));


  return (
    <>
      <Dialog open={open} onClose={props.onClose} slotProps={{ backdrop: { style: { opacity: 0 } } }}>
        <DialogContent>
          <Stack spacing={3}>
            <Typography variant="h5">Login with the web version of <b>Fog Companion</b></Typography>
            {!!error && <Alert severity="error">{error}</Alert>}
            <Button loading={!code} size="large" variant="contained" startIcon={<Login />} color="info">Click here to connect</Button>
            <Stack spacing={1} alignItems={'center'}>
              <Typography variant="body1">
                Alternatively, open <Link>Fog Companion Web</Link>, click "<i>Connect Overwolf Client</i>" and enter this code:
              </Typography>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h4">{code || <CircularProgress />}</Typography>
              </Paper>
            </Stack>
            <Button size="small" variant="outlined" startIcon={<Undo />} color="warning" onClick={reset}>Try again</Button>
          </Stack>
        </DialogContent>
      </Dialog>
      {loggedIn && props.children}
      <Button onClick={() => logout()}>logout</Button>
    </>
  )
}