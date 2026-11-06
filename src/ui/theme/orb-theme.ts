"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { createElement, type ReactNode } from "react";

declare module "@mui/material/styles" {
  interface Palette { tertiary: Palette["primary"]; }
  interface PaletteOptions { tertiary?: PaletteOptions["primary"]; }
}

export const orbTheme = createTheme({
  palette: {
    primary: { main: "#28536b", contrastText: "#ffffff" },
    secondary: { main: "#52606b", contrastText: "#ffffff" },
    tertiary: { main: "#66587a", contrastText: "#ffffff" },
    error: { main: "#ba1a1a", contrastText: "#ffffff" },
    background: { default: "#f7f9fc", paper: "#eaf0f4" },
    text: { primary: "#191c1e", secondary: "#52606b" },
  },
  shape: { borderRadius: 16 },
  spacing: 4,
  typography: { fontFamily: "system-ui, sans-serif" },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: false }, styleOverrides: { root: { minWidth: 48, minHeight: 48, "&.Mui-focusVisible": { outline: "3px solid #28536b", outlineOffset: 2 } } } },
  },
});

export function OrbThemeProvider({ children }: { readonly children: ReactNode }) {
  return createElement(ThemeProvider, { theme: orbTheme }, children);
}
