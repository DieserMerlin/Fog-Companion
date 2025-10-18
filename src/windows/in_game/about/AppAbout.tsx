import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import pkg from '../../../../package.json';
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import { useTutorial } from "../welcome/AppTutorial";
import { WELCOME_TUTORIALS } from "../welcome/tutorials/WelcomeTutorial";
import Link from "@mui/material/Link";

export const AppAbout = () => {
  const [noticeText, setNoticeText] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    fetch('/THIRD-PARTY-NOTICES.txt').then(res => res.text()).then(txt => setNoticeText(txt));
  }, []);

  return (
    <>
      <Dialog open={noticeOpen} onClose={() => setNoticeOpen(false)} maxWidth={"md"}>
        <Stack width={'100%'} p={2}>
          <Typography variant="h4">
            THIRD-PARTY-NOTICES
          </Typography>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{noticeText}</pre>
        </Stack>
      </Dialog>
      <Stack width={'100%'} height={'100%'} alignItems={"center"} justifyContent={"center"} p={4}>
        <Stack spacing={1} width={'100%'}>
          <Card variant="elevation">
            <CardContent>
              <Stack direction={'row'} alignItems={'center'} width={'100%'}>
                <Stack flexGrow={1}>
                  <Typography variant="h5">DBD COMPanion <Chip label={'v' + pkg.version} /></Typography>
                  <Typography variant="caption">by Merlin</Typography>
                  <small style={{ marginTop: 10, opacity: .6 }}>Default Callout graphics by <Link onClick={() => window.open('https://hens333.com', '_blank')}>Hens</Link>.</small>
                </Stack>
                <Stack alignItems={'end'} spacing={1}>
                  <small style={{ opacity: .8 }}>Like my work?</small>
                  <a href="https://www.buymeacoffee.com/DieserMerlin"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=DieserMerlin&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
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
            <Alert severity="warning" variant="outlined" sx={{ width: '100%', display: 'flex' }} slotProps={{ message: { style: { width: '100%' } } }}>
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
                <Button variant="outlined" style={{ height: '100%' }} onClick={() => useTutorial.getState().setTutorials(WELCOME_TUTORIALS)}>Restart Tutorial</Button>
              </Stack>
            </Alert>
          </Stack>
          <Stack direction={'row'} spacing={1}>
            <Alert severity="info" variant="outlined" sx={{ width: '100%' }}>
              <Stack direction={'row'} spacing={1} alignItems={'center'}>
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
            <Alert severity="error" variant="outlined" sx={{ width: '100%' }}>
              <Stack spacing={1}>
                <Typography variant="overline">
                  Do you have contact to Hens?
                </Typography>
                <Stack height={'100%'} justifyContent={'center'}>
                  <span>I tried contacting him but he ghosted me. 💀</span>
                  <span>If we can get his attention, maybe he will approve to use his callouts without copyright notice!</span>
                </Stack>
              </Stack>
            </Alert>
          </Stack>
        </Stack>
      </Stack>
    </>
  );
}