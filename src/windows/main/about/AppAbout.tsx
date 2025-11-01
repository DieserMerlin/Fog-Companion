import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import pkg from '../../../../package.json';
import { OverwolfLink } from "../../../utils/mui/OverwolfLink";
import { useTutorial } from "../welcome/AppTutorial";
import { WELCOME_TUTORIALS } from "../welcome/tutorials/WelcomeTutorial";
import IconButton from "@mui/material/IconButton";
import { Close, Code, DeveloperMode, Help, Undo } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";

export const AppAbout = () => {
  const [noticeText, setNoticeText] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    fetch('/THIRD-PARTY-NOTICES.txt').then(res => res.text()).then(txt => setNoticeText(txt));
  }, []);

  return (
    <>
      <Dialog open={noticeOpen} onClose={() => setNoticeOpen(false)} maxWidth={"md"} style={{ marginTop: 30 }}>
        <Stack width={'100%'} height={'100%'} overflow={'hidden'} p={2}>
          <Stack direction={'row'} alignItems={'center'} spacing={1}>
            <Typography variant="h4" style={{ flexGrow: 1 }}>
              THIRD-PARTY-NOTICES
            </Typography>
            <IconButton onClick={() => setNoticeOpen(false)}><Close /></IconButton>
          </Stack>
          <pre style={{ whiteSpace: 'pre-wrap', height: '100%', overflow: 'auto' }}>{noticeText}</pre>
        </Stack>
      </Dialog>
      <Stack width={'100%'} height={'100%'} alignItems={"center"} justifyContent={"center"} p={4}>
        <Stack spacing={1} width={'100%'}>
          <Paper variant="elevation">
            <Stack direction={'row'} alignItems={'center'} width={'100%'} spacing={2} p={2}>
              <Button variant="outlined" startIcon={<Undo />} style={{ placeSelf: 'normal' }} onClick={() => useTutorial.getState().setTutorials(WELCOME_TUTORIALS)}>Restart<br />Tutorial</Button>
              <Stack flexGrow={1}>
                <Typography variant="h5">Fog Companion <Chip size="small" color="primary" label={'v' + pkg.version} /></Typography>
                <Typography variant="caption">by Merlin</Typography>
                <span style={{ marginTop: 10, opacity: .8 }}>Huge thanks to <OverwolfLink href='https://hens333.com'>Hens</OverwolfLink> who permitted me to use his callout graphics as default!</span>
              </Stack>
              <Stack alignItems={'end'} spacing={1}>
                <small style={{ opacity: .8 }}>Like my work?</small>
                <a href="https://www.buymeacoffee.com/DieserMerlin"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=DieserMerlin&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
              </Stack>
            </Stack>
          </Paper>
          <Stack direction={'row'} spacing={1}>
            <Alert severity="info" variant="outlined" sx={{ width: '100%' }} slotProps={{ message: { style: { width: '100%' } } }}>
              <Stack width={'100%'} height={'100%'} spacing={1}>
                <Typography variant="overline">
                  Who is this app for?
                </Typography>
                <Stack height={'100%'} justifyContent={'center'}>
                  <span>This app is for the DBD competitive scene.</span>
                  <span>Whether you're a long-time comp player already or just got into it, it will make your life a bit easier! 😎</span>
                </Stack>
              </Stack>
            </Alert>
            <Alert severity="warning" icon={<Help />} variant="outlined" sx={{ width: '100%', display: 'flex' }} slotProps={{ message: { style: { width: '100%' } } }}>
              <Stack width={'100%'} height={'100%'} direction={'row'} spacing={1} flexGrow={1}>
                <Stack width={'100%'} height={'100%'} spacing={1} flexGrow={1}>
                  <Typography variant="overline">
                    You need help or have a feature proposal?
                  </Typography>
                  <Stack height={'100%'} justifyContent={'center'}>
                    <span>Don't hesitate to contact me on Discord!</span>
                    <span>My username is <b>@DieserMerlin</b>.</span>
                  </Stack>
                </Stack>
              </Stack>
            </Alert>
          </Stack>
          <Stack direction={'row'} spacing={1}>
            <Alert severity="info" icon={<Code />} variant="outlined" sx={{ width: '100%' }} slotProps={{ message: { style: { width: '100%' } } }}>
              <Stack direction={'row'} spacing={1} width={'100%'} alignItems={'center'}>
                <Stack spacing={1} flexGrow={1}>
                  <Typography variant="overline">
                    This app uses Open Source Software!
                  </Typography>
                  <Stack height={'100%'} justifyContent={'center'}>
                    <span>
                      To write this application, I used some awesome frameworks and libraries.
                      Go check them out!
                    </span>
                  </Stack>
                </Stack>
                <Button color="info" style={{ height: '100%' }} variant="outlined" disabled={!noticeText} onClick={() => setNoticeOpen(true)}>
                  Open Third Party Notices
                </Button>
              </Stack>
            </Alert>
          </Stack>
          <Alert severity="warning" variant="outlined" sx={{ width: '100%' }}>
            <Stack spacing={1}>
              <Typography variant="overline">
                Disclaimer
              </Typography>
              <Stack height={'100%'} justifyContent={'center'}>
                <ol>
                  <li>
                    This application is an independent, fan-made project and is in no way
                    affiliated with, endorsed by, or sponsored by <b>Behaviour Interactive</b> or <b>Dead by Daylight</b>.
                  </li>
                  <li>
                    To the best of my knowledge,
                    <b> using Overwolf with Dead by Daylight has not been shown to result in bans</b>.
                    However, I <b>cannot guarantee</b> that this will remain the case, and I
                    <b> accept no responsibility or liability</b> should the use of this application or Overwolf
                    lead to a ban, suspension, or any other account-related issue.
                  </li>
                  <li>
                    This app is <b>intended for informational and competitive purposes only</b>, not to <b>modify gameplay</b>, <b>access restricted game data</b>, or
                    <b> provide unfair advantages</b>.
                  </li>
                </ol>
              </Stack>
            </Stack>
          </Alert>
        </Stack >
      </Stack >
    </>
  );
}