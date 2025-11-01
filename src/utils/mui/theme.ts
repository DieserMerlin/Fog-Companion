import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#ff5555ff' },
    warning: { main: '#ffbe69ff' },
    background: { default: '#0d0f18ff', paper: '#191829ff' }
  },
  shape: {
    borderRadius: 6
  }
});
