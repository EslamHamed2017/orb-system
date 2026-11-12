"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { createElement, type ReactNode } from "react";

declare module "@mui/material/styles" {
  interface Palette { tertiary: Palette["primary"]; }
  interface PaletteOptions { tertiary?: PaletteOptions["primary"]; }
}

export const orbTheme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: "#0b57d0", dark: "#0842a0", light: "#d3e3fd", contrastText: "#ffffff" },
    secondary: { main: "#5f6368", contrastText: "#ffffff" },
    tertiary: { main: "#146c2e", contrastText: "#ffffff" },
    error: { main: "#b3261e", contrastText: "#ffffff" },
    warning: { main: "#8a4f00", light: "#ffedc7" },
    success: { main: "#146c2e", light: "#c4eed0" },
    background: { default: "#f8fafd", paper: "#ffffff" },
    text: { primary: "#1f1f1f", secondary: "#5f6368" },
    divider: "#e2e6eb",
  },
  shape: { borderRadius: 12 },
  spacing: 4,
  typography: {
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    h1: { fontSize: "2rem", lineHeight: 1.2, fontWeight: 650, letterSpacing: "-.02em" },
    h2: { fontSize: "1.25rem", lineHeight: 1.3, fontWeight: 650 },
    button: { fontWeight: 650, textTransform: "none" },
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: false }, styleOverrides: { root: { minWidth: 48, minHeight: 48, "&.Mui-focusVisible": { outline: "3px solid #0b57d0", outlineOffset: 2 } } } },
    MuiCard: { styleOverrides: { root: { border: "1px solid #e2e6eb", boxShadow: "0 1px 2px rgba(60,64,67,.08)" } } },
  },
});

export function OrbThemeProvider({ children }: { readonly children: ReactNode }) {
  return createElement(ThemeProvider, { theme: orbTheme }, children);
}
