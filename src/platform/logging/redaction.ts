export const REDACTED = "[REDACTED]" as const;
const CIRCULAR = "[CIRCULAR]" as const;

const SECRET_KEY = /(?:authorization|password|passwd|secret|token|cookie|csrf|sessionid|accesskey|encryption(?:key)?|privatekey)/i;
const IDENTITY_CONTAINER = /^(?:actor|identity|profile|user)$/i;
const IDENTITY_FIELD = /^(?:displayname|email|legalname|phone|address|nationalid|passport|sensitiveidentity)$/i;

export function createLogRedactor(secretValues: readonly string[] = []): (value: unknown) => unknown {
  const secrets = [...new Set(secretValues.filter(Boolean))].sort((a, b) => b.length - a.length);
  const redactString = (value: string) => {
    const knownSecretsRemoved = secrets.reduce((result, secret) => result.split(secret).join(REDACTED), value);
    return knownSecretsRemoved.replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)([^\s@]+)(@)/gi, `$1${REDACTED}$3`);
  };

  return function redact(value: unknown): unknown {
    const active = new WeakSet<object>();
    function visit(current: unknown, key = ""): unknown {
      if (SECRET_KEY.test(key) || IDENTITY_CONTAINER.test(key) || IDENTITY_FIELD.test(key)) return REDACTED;
      if (typeof current === "string") return redactString(current);
      if (current === null || typeof current !== "object") return current;
      if (active.has(current)) return CIRCULAR;
      active.add(current);
      let result: unknown;
      if (Array.isArray(current)) result = current.map((entry) => visit(entry));
      else if (current instanceof Date) result = current.toISOString();
      else {
        const output: Record<string, unknown> = {};
        for (const [childKey, child] of Object.entries(current)) output[childKey] = visit(child, childKey);
        result = output;
      }
      active.delete(current);
      return result;
    }
    return visit(value);
  };
}
