"use client";

import { App, ConfigProvider, theme } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";
import { useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Ant Design for ORB (docs/UI-AND-WORKFLOW-STANDARD.md): ORB teal, accounting-dense by default, Arabic RTL.
 * Density is a per-user choice kept in this browser; tables read and change it through `useOrbDensity`.
 */
export const ORB_PRIMARY = "#0b6e69";
type Density = "compact" | "normal";
const DENSITY_KEY = "orb.density";

const DensityContext = createContext<{ density: Density; setDensity: (value: Density) => void }>({ density: "compact", setDensity: () => undefined });
export const useOrbDensity = () => useContext(DensityContext);

function readDensity(): Density {
  try { return window.localStorage.getItem(DENSITY_KEY) === "normal" ? "normal" : "compact"; } catch { return "compact"; }
}

export function AntProvider({ children }: { readonly children: ReactNode }) {
  const search = useSearchParams();
  const ar = search.get("locale") === "ar";
  const [density, setDensityState] = useState<Density>("compact");
  useEffect(() => { setDensityState(readDensity()); }, []);
  const setDensity = useCallback((value: Density) => {
    setDensityState(value);
    try { window.localStorage.setItem(DENSITY_KEY, value); } catch { /* private mode: keep it for this visit */ }
  }, []);
  const densityValue = useMemo(() => ({ density, setDensity }), [density, setDensity]);
  return <ConfigProvider
    direction={ar ? "rtl" : "ltr"}
    locale={ar ? arEG : enUS}
    theme={{
      cssVar: { key: "orb" },
      algorithm: density === "compact" ? [theme.defaultAlgorithm, theme.compactAlgorithm] : theme.defaultAlgorithm,
      token: {
        colorPrimary: ORB_PRIMARY,
        colorLink: ORB_PRIMARY,
        borderRadius: 6,
        fontFamily: ar
          ? "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, 'Noto Sans Arabic', sans-serif"
          : "Inter, 'Segoe UI', Roboto, Arial, sans-serif",
      },
      components: { Table: { headerBg: "#f6f8fa", rowHoverBg: "#eef6f5" } },
    }}>
    <App component={false}>
      <DensityContext.Provider value={densityValue}>{children}</DensityContext.Provider>
    </App>
  </ConfigProvider>;
}
