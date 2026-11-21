import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppNavigation } from "../ui/navigation/AppNavigation";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { OrbThemeProvider } from "../ui/theme/orb-theme";
import { AntProvider } from "../ui/theme/AntProvider";
import "../ui/theme/tokens.css";
import "../ui/theme/density.css";

export const metadata: Metadata = {
  title: { default: "ORB Trade Operations", template: "%s · ORB" },
  description: "Controlled bilingual trade operations",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" dir="ltr">
    <body>
      <AntdRegistry hashPriority="high">
        <OrbThemeProvider>
          <Suspense fallback={<div className="orb-main" role="status" aria-busy="true">Loading ORB…</div>}>
            <AntProvider>
              <AppNavigation>{children}</AppNavigation>
            </AntProvider>
          </Suspense>
        </OrbThemeProvider>
      </AntdRegistry>
    </body>
  </html>;
}
