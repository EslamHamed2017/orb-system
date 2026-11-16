export function productMutationHeaders(): Record<string, string> {
  const csrf = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("__Host-orb_csrf="))?.slice("__Host-orb_csrf=".length) ?? "";
  return { "X-CSRF-Token": decodeURIComponent(csrf), "Idempotency-Key": crypto.randomUUID() };
}
