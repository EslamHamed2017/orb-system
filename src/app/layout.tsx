import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppNavigation } from "../ui/navigation/AppNavigation";
import { OrbThemeProvider } from "../ui/theme/orb-theme";
import "../ui/theme/tokens.css";

export const metadata: Metadata = {
  title: { default: "ORB Trade Operations", template: "%s · ORB" },
  description: "Controlled bilingual trade operations",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" dir="ltr">
    <body>
      <OrbThemeProvider>
        <Suspense fallback={<main className="orb-main" aria-busy="true">Loading ORB…</main>}>
          <AppNavigation>{children}</AppNavigation>
        </Suspense>
      </OrbThemeProvider>
    </body>
  </html>;
}
