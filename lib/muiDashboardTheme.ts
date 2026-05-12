import { createTheme } from "@mui/material/styles";

/** Matches fancy_lightdarkmode App.tsx — used only for the theme switch transitions. */
export const dashboardMuiTheme = createTheme({
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 700,
      complex: 700,
      enteringScreen: 700,
      leavingScreen: 700,
    },
    easing: {
      easeInOut: "cubic-bezier(0.25, 0.8, 0.25, 1)",
      easeOut: "cubic-bezier(0.25, 0.8, 0.25, 1)",
      easeIn: "cubic-bezier(0.25, 0.8, 0.25, 1)",
      sharp: "cubic-bezier(0.25, 0.8, 0.25, 1)",
    },
  },
});
