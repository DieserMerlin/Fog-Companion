import Stack from "@mui/material/Stack";
import { Tutorial } from "../AppTutorial";
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
