import { localizedDomainTerms } from "../../platform/i18n/domain-terminology";

export const en = {
  language: "English",
  primaryNavigation: "Primary navigation",
  today: "Today",
  projects: "Projects",
  approvals: "Approvals",
  more: "More",
  close: "Close",
  menuTitle: "More destinations",
  shellTitle: "Trade operations",
  reference: "ORB-R1",
  domain: localizedDomainTerms("en"),
  states: {
    loading: { title: "Loading", detail: "The latest operational data is loading." },
    empty: { title: "Nothing here yet", detail: "Create the first operational record.", action: "View projects" },
    error: { title: "Unable to load", detail: "The request failed without losing your work.", action: "Try again" },
    "permission-denied": { title: "Permission required", detail: "Your fixed role cannot view this content.", action: "Return to Today" },
    offline: { title: "You are offline", detail: "Reconnect before making a controlled change.", action: "Retry connection" },
    "stale-version": { title: "A newer version exists", detail: "Compare and reload instead of overwriting it.", action: "Reload latest version" },
  },
} as const;
