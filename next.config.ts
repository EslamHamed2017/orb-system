import type { NextConfig } from "next";

export function buildContentSecurityPolicy(managedServer: boolean, baseUrl: string | undefined) {
  const loopbackHttpTest = managedServer && /^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl ?? "");
  return [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  ...(loopbackHttpTest ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const contentSecurityPolicy = buildContentSecurityPolicy(
  process.env.ORB_TEST_MANAGED_SERVER === "1",
  process.env.ORB_TEST_BASE_URL,
);

const globalSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
] as const;

const signInSecurityHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [
      { source: "/:path*", headers: [...globalSecurityHeaders] },
      { source: "/sign-in", headers: [...signInSecurityHeaders] },
    ];
  },
};

export default nextConfig;
