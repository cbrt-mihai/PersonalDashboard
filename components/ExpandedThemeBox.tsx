"use client";

import Box from "@mui/material/Box";
import { ExpandedThemeSwitch } from "@/components/ExpandedThemeSwitch";

export type ExpandedThemeBoxProps = {
  /** True when the app is in dark appearance (matches fancy `checked` / darkMode). */
  isChecked: boolean;
  toggleTheme: () => void;
};

const ExpandedThemeBox = ({
  isChecked,
  toggleTheme,
}: ExpandedThemeBoxProps) => {
  return (
    <Box
      className="flex flex-shrink-0 items-center justify-end"
      data-cy="app.drawer.theme.expanded"
    >
      <ExpandedThemeSwitch
        sx={{ m: 0 }}
        checked={!isChecked}
        onChange={toggleTheme}
        disableRipple
        focusVisibleClassName=".Mui-focusVisible"
        slotProps={{
          input: { "aria-label": "Toggle light or dark color theme" },
        }}
      />
    </Box>
  );
};

export default ExpandedThemeBox;
