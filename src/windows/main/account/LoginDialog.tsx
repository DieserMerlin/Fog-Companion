import { LoginFeatureCard } from "@diesermerlin/fog-companion-web";
import { Login, Shuffle } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { skipToken, useMutation } from "@tanstack/react-query";
import { useSubscription } from '@trpc/tanstack-react-query';
import { AnimatePresence, motion, MotionConfigContext } from "motion/react";
import { PropsWithChildren, useContext, useEffect, useRef, useState } from "react";
import { APP_CONFIG } from "../../../AppConfig";
import { ConfirmOpenLinkExternally } from "../../../utils/mui/OverwolfLink";
import { useTRPC } from "../../../utils/trpc/trpc";
import { useSession } from "../../../utils/trpc/use-session";
import { MainAppTab, useMainApp } from "../use-main-app";

const NUM_INPUTS = 6;
const BLUR = 4;

const randomChar = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVQXYZ1234567890";
  const randomIndex = Math.floor(Math.random() * chars.length);
  return chars[randomIndex];
};

const SingleCharSlot = (props: {
  char: string | null;
  interval: number;
  delay: number;
}) => {
  const showCharRef = useRef<string>(null);
  showCharRef.current = props.char;

  const [display, setDisplay] = useState({ char: randomChar(), show: false });

  const lastCharRef = useRef<string>(null);

  useEffect(() => {
    const tick = () => {
      let char: string;

      if (showCharRef.current) char = showCharRef.current;
      else
        do char = randomChar();
        while (char === lastCharRef.current);

      setDisplay({ char, show: char === showCharRef.current });
      lastCharRef.current = char;
    };
    tick();
    const interval = setInterval(tick, props.interval);

    return () => clearInterval(interval);
  }, [props.interval, props.char]);

  const motionConfig = useContext(MotionConfigContext);

  return (
    <div
      style={{
        width: 60,
        height: 60,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <AnimatePresence mode="sync">
        <motion.span
          style={{ position: 'absolute' }}
          key={display.char}
          initial={{ opacity: 0, filter: `blur(${BLUR}px)` }}
          animate={{ opacity: 1, filter: `blur(${display.show ? 0 : BLUR}px)` }}
          exit={{ opacity: 0, filter: `blur(${BLUR}px)` }}
          children={display.char}
          transition={{ ...motionConfig.transition, delay: props.delay / 1000 }}
        />
      </AnimatePresence>
    </div>
  );
};

export const LoginDialogWrapper = (props: PropsWithChildren<{ onClose: () => void }>) => {
  const trpc = useTRPC();

  const loggedIn = useSession(s => !!s.session?.user);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const { mutate } = useMutation(trpc.sessions.getOverwolfSession.mutationOptions({ onSuccess: () => useSession.getState().recheck() }));
  const { reset, status } = useSubscription(trpc.sessions.overwolfLogin.subscriptionOptions(loggedIn ? skipToken : void 0, {
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

  return (
    !loggedIn ? <>
      <Stack direction={'row'} spacing={1} height={'100%'} alignItems={'center'} >
        <Stack spacing={3} width={'100%'} alignItems={'center'}>
          <Typography variant="h5">Login with the web version of <b>Fog Companion</b></Typography>
          {!!error && <Alert severity="error">{error}</Alert>}
          <ConfirmOpenLinkExternally href={APP_CONFIG.BACKEND_URL + '/connect?code=' + code}>
            <Button disabled={!code} loading={!code} size="large" variant="contained" startIcon={<Login />} color="info">Click here to connect</Button>
          </ConfirmOpenLinkExternally>
          <Stack spacing={1} alignItems={'center'}>
            <Typography variant="body1">
              Alternatively, open <Link>Fog Companion Web</Link>, click "<i>Connect Overwolf Client</i>" and enter this code:
            </Typography>
            <Stack direction={'row'} spacing={1}>
              {new Array(NUM_INPUTS).fill(0).map((_, i) => (
                <Paper sx={{ p: 1, fontSize: '1.5em', fontWeight: 'bold' }}>
                  <SingleCharSlot key={'slot-' + i} char={code?.[i] || null} delay={i * 80} interval={600} />
                </Paper>
              ))}
            </Stack>
          </Stack>
          <Button size="small" variant="outlined" startIcon={<Shuffle />} color="warning" onClick={reset}>New Code</Button>
        </Stack>
        <LoginFeatureCard />
      </Stack>
    </> : props.children
  )
}
