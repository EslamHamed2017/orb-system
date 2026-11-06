const ESCAPED_CONTROL = /[\u0000-\u001f"\\]/g;
const INVALID_UNICODE = /[\ud800-\udfff]/u;

function quote(value: string): string {
  if (INVALID_UNICODE.test(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          index += 1;
          continue;
        }
        throw new TypeError("RFC 8785 canonical JSON rejects lone UTF-16 surrogates");
      }
      if (code >= 0xdc00 && code <= 0xdfff) {
        throw new TypeError("RFC 8785 canonical JSON rejects lone UTF-16 surrogates");
      }
    }
  }

  const escapes: Record<string, string> = {
    "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r", '"': '\\"', "\\": "\\\\",
  };
  return `"${value.replace(ESCAPED_CONTROL, (character) =>
    escapes[character] ?? `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}"`;
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return quote(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("RFC 8785 canonical JSON requires finite numbers");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`RFC 8785 canonical JSON cannot serialize ${typeof value}`);
  }
  if (ancestors.has(value)) throw new TypeError("RFC 8785 canonical JSON cannot serialize cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value.map((item, index) => {
        if (!(index in value) || item === undefined) {
          throw new TypeError("RFC 8785 canonical JSON rejects sparse or undefined array entries");
        }
        return serialize(item, ancestors);
      });
      return `[${items.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("RFC 8785 canonical JSON accepts only JSON objects");
    }
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    const members = keys.map((key) => {
      if (object[key] === undefined) throw new TypeError("RFC 8785 canonical JSON rejects undefined members");
      return `${quote(key)}:${serialize(object[key], ancestors)}`;
    });
    return `{${members.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

/** RFC 8785 JSON Canonicalization Scheme for already parsed I-JSON values. */
export function canonicalizeJson(value: unknown): string {
  return serialize(value, new Set());
}
