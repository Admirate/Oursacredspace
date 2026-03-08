import {
  timingSafeCompare,
  generateSecureId,
  sanitizeTemplateParam,
  validateImageMagicBytes,
  getClientIP,
  isRateLimited,
  sanitizeString,
  validateEnvVars,
  isAllowedOrigin,
  getValidatedOrigin,
  RATE_LIMITS,
} from "../netlify/functions/helpers/security";
import { HandlerEvent } from "@netlify/functions";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/test",
  rawQuery: "",
  path: "/.netlify/functions/test",
  httpMethod: "GET",
  headers: {},
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
  ...overrides,
});

// ─── timingSafeCompare ───────────────────────────────────

describe("timingSafeCompare", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeCompare("hello", "hello")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeCompare("hello", "world")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeCompare("short", "a much longer string")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(timingSafeCompare("", "")).toBe(true);
  });

  it("returns false for empty vs non-empty", () => {
    expect(timingSafeCompare("", "something")).toBe(false);
  });
});

// ─── generateSecureId ────────────────────────────────────

describe("generateSecureId", () => {
  it("generates a string of the requested length", () => {
    expect(generateSecureId(8)).toHaveLength(8);
    expect(generateSecureId(16)).toHaveLength(16);
    expect(generateSecureId(32)).toHaveLength(32);
  });

  it("only uses characters from the default charset", () => {
    const id = generateSecureId(100);
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (const char of id) {
      expect(charset).toContain(char);
    }
  });

  it("uses a custom charset when provided", () => {
    const id = generateSecureId(50, "abc");
    for (const char of id) {
      expect("abc").toContain(char);
    }
  });

  it("generates unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSecureId(16)));
    expect(ids.size).toBe(100);
  });
});

// ─── sanitizeTemplateParam ───────────────────────────────

describe("sanitizeTemplateParam", () => {
  it("removes angle brackets and curly braces", () => {
    expect(sanitizeTemplateParam("<script>alert('xss')</script>")).toBe(
      "scriptalert('xss')/script"
    );
  });

  it("replaces newlines and tabs with spaces", () => {
    expect(sanitizeTemplateParam("line1\nline2\ttab")).toBe("line1 line2 tab");
  });

  it("collapses multiple spaces", () => {
    expect(sanitizeTemplateParam("a    b     c")).toBe("a b c");
  });

  it("trims whitespace", () => {
    expect(sanitizeTemplateParam("  hello  ")).toBe("hello");
  });

  it("truncates to maxLength", () => {
    const long = "a".repeat(200);
    expect(sanitizeTemplateParam(long, 50)).toHaveLength(50);
  });

  it("uses default maxLength of 100", () => {
    const long = "x".repeat(150);
    expect(sanitizeTemplateParam(long)).toHaveLength(100);
  });

  it("removes square brackets and backslashes", () => {
    expect(sanitizeTemplateParam("hello[world]\\test")).toBe("helloworldtest");
  });
});

// ─── validateImageMagicBytes ─────────────────────────────

describe("validateImageMagicBytes", () => {
  it("detects JPEG", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(validateImageMagicBytes(buf)).toEqual({ valid: true, mimeType: "image/jpeg" });
  });

  it("detects PNG", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(validateImageMagicBytes(buf)).toEqual({ valid: true, mimeType: "image/png" });
  });

  it("detects GIF", () => {
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39]);
    expect(validateImageMagicBytes(buf)).toEqual({ valid: true, mimeType: "image/gif" });
  });

  it("detects WebP", () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
    expect(validateImageMagicBytes(buf)).toEqual({ valid: true, mimeType: "image/webp" });
  });

  it("rejects unknown format", () => {
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(validateImageMagicBytes(buf)).toEqual({ valid: false, mimeType: null });
  });

  it("rejects buffer too short", () => {
    const buf = Buffer.from([0xff, 0xd8]);
    expect(validateImageMagicBytes(buf)).toEqual({ valid: false, mimeType: null });
  });

  it("rejects empty buffer", () => {
    expect(validateImageMagicBytes(Buffer.alloc(0))).toEqual({ valid: false, mimeType: null });
  });
});

// ─── getClientIP ─────────────────────────────────────────

describe("getClientIP", () => {
  it("extracts IP from x-forwarded-for (first entry)", () => {
    const event = makeEvent({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIP(event)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const event = makeEvent({ headers: { "x-real-ip": "10.0.0.1" } });
    expect(getClientIP(event)).toBe("10.0.0.1");
  });

  it("falls back to client-ip", () => {
    const event = makeEvent({ headers: { "client-ip": "192.168.1.1" } });
    expect(getClientIP(event)).toBe("192.168.1.1");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const event = makeEvent();
    expect(getClientIP(event)).toBe("unknown");
  });
});

// ─── isRateLimited ───────────────────────────────────────

describe("isRateLimited", () => {
  it("allows requests below the limit", () => {
    const key = `test-rate-${Date.now()}`;
    expect(isRateLimited(key, 5, 60000)).toBe(false);
    expect(isRateLimited(key, 5, 60000)).toBe(false);
    expect(isRateLimited(key, 5, 60000)).toBe(false);
  });

  it("blocks requests above the limit", () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) isRateLimited(key, 3, 60000);
    expect(isRateLimited(key, 3, 60000)).toBe(true);
  });

  it("different keys are independent", () => {
    const keyA = `test-a-${Date.now()}`;
    const keyB = `test-b-${Date.now()}`;
    for (let i = 0; i < 5; i++) isRateLimited(keyA, 3, 60000);
    expect(isRateLimited(keyB, 3, 60000)).toBe(false);
  });
});

// ─── sanitizeString ──────────────────────────────────────

describe("sanitizeString", () => {
  it("escapes HTML special characters", () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(sanitizeString("a & b")).toBe("a &amp; b");
  });

  it("escapes single quotes", () => {
    expect(sanitizeString("it's")).toBe("it&#x27;s");
  });

  it("leaves clean strings unchanged (except forward slashes)", () => {
    expect(sanitizeString("hello world 123")).toBe("hello world 123");
  });
});

// ─── validateEnvVars ─────────────────────────────────────

describe("validateEnvVars", () => {
  it("returns valid when all vars are set", () => {
    process.env.TEST_VAR_A = "value";
    process.env.TEST_VAR_B = "value";
    const result = validateEnvVars(["TEST_VAR_A", "TEST_VAR_B"]);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    delete process.env.TEST_VAR_A;
    delete process.env.TEST_VAR_B;
  });

  it("returns invalid with missing vars listed", () => {
    const result = validateEnvVars(["NONEXISTENT_VAR_XYZ", "ANOTHER_MISSING"]);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(["NONEXISTENT_VAR_XYZ", "ANOTHER_MISSING"]);
  });

  it("handles empty array", () => {
    expect(validateEnvVars([]).valid).toBe(true);
  });
});

// ─── CORS / Origin helpers ───────────────────────────────

describe("isAllowedOrigin", () => {
  it("allows requests without origin header (same-origin)", () => {
    const event = makeEvent();
    expect(isAllowedOrigin(event)).toBe(true);
  });

  it("allows localhost:3000", () => {
    const event = makeEvent({ headers: { origin: "http://localhost:3000" } });
    expect(isAllowedOrigin(event)).toBe(true);
  });

  it("allows localhost:8888", () => {
    const event = makeEvent({ headers: { origin: "http://localhost:8888" } });
    expect(isAllowedOrigin(event)).toBe(true);
  });

  it("rejects unknown origins", () => {
    const event = makeEvent({ headers: { origin: "http://evil.com" } });
    expect(isAllowedOrigin(event)).toBe(false);
  });
});

describe("getValidatedOrigin", () => {
  it("returns the origin if it is allowed", () => {
    const event = makeEvent({ headers: { origin: "http://localhost:3000" } });
    expect(getValidatedOrigin(event)).toBe("http://localhost:3000");
  });

  it("returns fallback for disallowed origin", () => {
    const event = makeEvent({ headers: { origin: "http://evil.com" } });
    const result = getValidatedOrigin(event);
    expect(result).toMatch(/localhost/);
  });
});

// ─── RATE_LIMITS constants ───────────────────────────────

describe("RATE_LIMITS", () => {
  it("has sensible defaults for all endpoint types", () => {
    expect(RATE_LIMITS.LOGIN.maxRequests).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.PAYMENT.maxRequests).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.PUBLIC_READ.maxRequests).toBeGreaterThan(50);
    expect(RATE_LIMITS.ADMIN_READ.maxRequests).toBeGreaterThan(100);
  });
});
