import Alert from "@mui/material/Alert";
import { HighlightTutorial } from "../AppHighlightTutorial";

export const Mode1v1ViewTutorial = {
  CurrentChallenge: {
    hltId: "1v1-view-current-challenge",
    contentPosition: 'below',
    title: "Current challenge",
    content: <>
      <span>Here you can see the active 1v1 challenge.</span>
      <span>A challenge is a <b>session of 1v1 games with a certain opponent</b>.</span>
    </>
  },
  PreviousChallenges: {
    hltId: "1v1-view-previous-challenges",
    contentPosition: 'above',
    title: "Previous challenges",
    content: <>
      <span>Here you can see your previous challenges.</span>
      <span>You can edit <b>times</b>, <b>killers</b> and <b>opponent names</b> and you can <b>continue</b> any session.</span>
    </>
  },
  PointsDisplay: {
    hltId: "1v1-view-points-display",
    contentPosition: 'right',
    title: "Points",
    content: <>
      <span>Here you can see the result of games played in the current challenge.</span>
    </>
  },
  EditOpponentNameInput: {
    hltId: "1v1-view-edit-opponent-name-input",
    contentPosition: 'right',
    title: "Edit opponent name",
    content: <>
      <span>You can change the <b>opponent name</b>. Use this to filter stats against certain opponents!</span>
    </>
  },
  EditGamesMenu: {
    hltId: "1v1-view-edit-games-btn",
    contentPosition: 'below',
    title: "Edit games",
    content: <>
      <span>Here you can <b>adjust timer values</b> and <b>select killers</b>.</span>
      <small>If auto-detection is turned on, you can leave the killer blank and let the app work for you!</small>
    </>
  },
  NextGameBtn: {
    hltId: "1v1-view-next-game-btn",
    contentPosition: 'below-left',
    title: "Next game",
    content: <>
      <span>Here you can start a new game - up to 30 games per challenge.</span>
      <small>This only works if your current game has at least one timer value!</small>
      <Alert severity="info" variant="outlined">When you come out of a match with both timer values, a new game will be appended automatically!</Alert>
    </>
  },
  CommitChallengeBtn: {
    hltId: "1v1-view-commit-challenge-btn",
    contentPosition: 'below-left',
    title: "Commit challenge / Create new challenge",
    content: <>
      <span>Here you can <b>save your current challenge</b> and <b>create a new one</b>.</span>
      <small>This only works if there's <i>at least</i> one finished game in the current challenge!</small>
    </>
  },
} as const satisfies HighlightTutorial;
