import Stack from "@mui/material/Stack";
import { Tutorial, useTutorial } from "../AppTutorial";
import { CALLOUT_TUTORIAL } from "./CalloutTutorial";
import { MODE_1V1_TUTORIAL } from "./Mode1v1Tutorial";

export const WELCOME_TUTORIAL: Tutorial = {
  title: 'Welcome 👋',
  content: (
    <>
      <Stack>
        <span>I'm your companion for competitive DBD.</span>
        <span>Ready to see what I can do?</span>
      </Stack>
    </>
  ),
  notice: 'You can skip the tutorial if you want',
  steps: [],
  media: { type: 'image', position: 'center', src: '/img/Logo.png', fit: 'contain' },
  buttonTexts: { next: "Let's go 😎" }
}

export const WELCOME_TUTORIALS = [WELCOME_TUTORIAL, CALLOUT_TUTORIAL, MODE_1V1_TUTORIAL];


// one-time bootstrap tutorials
if (!localStorage.getItem('tutorial')) {
  localStorage.setItem('tutorial', '0');
}

if (localStorage.getItem('tutorial') !== 'finished') {
  const raw = Number.parseInt(localStorage.getItem('tutorial') || '0', 10);
  useTutorial.setState({
    tutorials: WELCOME_TUTORIALS,
    currentIndex: Number.isFinite(raw) ? raw : 0,
  });
}

useTutorial.subscribe((state, prev) => {
  if (localStorage.getItem('tutorial') === 'finished') return;
  if (state.tutorials.length === 0 && prev.tutorials.length > 0)
    localStorage.setItem('tutorial', 'finished');
  else
    localStorage.setItem('tutorial', String(Number.isFinite(state.currentIndex) ? state.currentIndex : 0));
});
