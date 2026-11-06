import { afterAll, beforeAll, vi } from "vitest";

const { blocked } = vi.hoisted(() => ({
  blocked: () => {
    throw new Error(
      "Unit tests cannot access the network; inject a local test double instead.",
    );
  },
}));

vi.mock("node:http", async () => {
  const actual = await vi.importActual<typeof import("node:http")>("node:http");
  return {
    ...actual,
    default: { ...actual, get: blocked, request: blocked },
    get: blocked,
    request: blocked,
  };
});

vi.mock("node:https", async () => {
  const actual = await vi.importActual<typeof import("node:https")>("node:https");
  return {
    ...actual,
    default: { ...actual, get: blocked, request: blocked },
    get: blocked,
    request: blocked,
  };
});

vi.mock("node:net", async () => {
  const actual = await vi.importActual<typeof import("node:net")>("node:net");
  return {
    ...actual,
    default: {
      ...actual,
      connect: blocked,
      createConnection: blocked,
    },
    connect: blocked,
    createConnection: blocked,
  };
});

beforeAll(() => {
  vi.stubGlobal("fetch", blocked);
  vi.stubGlobal("WebSocket", class BlockedWebSocket {
    constructor() {
      blocked();
    }
  });
  vi.stubGlobal("EventSource", class BlockedEventSource {
    constructor() {
      blocked();
    }
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
