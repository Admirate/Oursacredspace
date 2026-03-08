import {
  phoneSchema,
  emailSchema,
  nameSchema,
  createClassBookingSchema,
  createEventBookingSchema,
  createSpaceBookingSchema,
  adminLoginSchema,
  adminCheckinPassSchema,
} from "../src/lib/validators";

// ─── phoneSchema ─────────────────────────────────────────

describe("phoneSchema", () => {
  it("accepts a valid 10-digit number and prepends +91", () => {
    const result = phoneSchema.parse("9876543210");
    expect(result).toBe("+919876543210");
  });

  it("accepts a number already prefixed with +91", () => {
    const result = phoneSchema.parse("+919876543210");
    expect(result).toBe("+919876543210");
  });

  it("accepts 91XXXXXXXXXX format (12 digits)", () => {
    const result = phoneSchema.parse("919876543210");
    expect(result).toBe("+919876543210");
  });

  it("strips non-digit characters before normalizing", () => {
    const result = phoneSchema.parse("98-7654-3210");
    expect(result).toBe("+919876543210");
  });

  it("rejects numbers with less than 10 digits", () => {
    expect(() => phoneSchema.parse("12345")).toThrow();
  });

  it("accepts any 10-digit number (validation is format-only)", () => {
    const result = phoneSchema.parse("1234567890");
    expect(result).toBe("+911234567890");
  });

  it("rejects empty string", () => {
    expect(() => phoneSchema.parse("")).toThrow();
  });
});

// ─── emailSchema ─────────────────────────────────────────

describe("emailSchema", () => {
  it("accepts valid email", () => {
    expect(emailSchema.parse("user@example.com")).toBe("user@example.com");
  });

  it("rejects invalid email", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => emailSchema.parse("")).toThrow();
  });
});

// ─── nameSchema ──────────────────────────────────────────

describe("nameSchema", () => {
  it("accepts valid name", () => {
    expect(nameSchema.parse("John Doe")).toBe("John Doe");
  });

  it("rejects single character", () => {
    expect(() => nameSchema.parse("J")).toThrow();
  });

  it("rejects names with numbers", () => {
    expect(() => nameSchema.parse("John123")).toThrow();
  });

  it("rejects names with special characters", () => {
    expect(() => nameSchema.parse("John@Doe")).toThrow();
  });

  it("rejects names over 100 chars", () => {
    expect(() => nameSchema.parse("A".repeat(101))).toThrow();
  });

  it("accepts names with spaces", () => {
    expect(nameSchema.parse("Mary Jane Watson")).toBe("Mary Jane Watson");
  });
});

// ─── createClassBookingSchema ────────────────────────────

describe("createClassBookingSchema", () => {
  const validData = {
    name: "Test User",
    phone: "9876543210",
    email: "test@example.com",
    classSessionId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("accepts valid class booking data", () => {
    const result = createClassBookingSchema.parse(validData);
    expect(result.name).toBe("Test User");
    expect(result.phone).toBe("+919876543210");
    expect(result.email).toBe("test@example.com");
  });

  it("rejects missing name", () => {
    expect(() =>
      createClassBookingSchema.parse({ ...validData, name: "" })
    ).toThrow();
  });

  it("rejects missing email", () => {
    expect(() =>
      createClassBookingSchema.parse({ ...validData, email: "" })
    ).toThrow();
  });

  it("rejects invalid classSessionId", () => {
    expect(() =>
      createClassBookingSchema.parse({ ...validData, classSessionId: "not-a-uuid" })
    ).toThrow();
  });
});

// ─── createEventBookingSchema ────────────────────────────

describe("createEventBookingSchema", () => {
  const validData = {
    name: "Test User",
    phone: "9876543210",
    email: "test@example.com",
    eventId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("accepts valid event booking data", () => {
    const result = createEventBookingSchema.parse(validData);
    expect(result.eventId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid eventId", () => {
    expect(() =>
      createEventBookingSchema.parse({ ...validData, eventId: "bad" })
    ).toThrow();
  });
});

// ─── createSpaceBookingSchema ────────────────────────────

describe("createSpaceBookingSchema", () => {
  const validData = {
    name: "Test User",
    phone: "9876543210",
    email: "test@example.com",
    preferredSlots: ["2026-03-15T10:00:00.000Z (2 hours)"],
    purpose: "Workshop on pottery for beginners",
  };

  it("accepts valid space booking data", () => {
    const result = createSpaceBookingSchema.parse(validData);
    expect(result.preferredSlots).toHaveLength(1);
  });

  it("rejects empty preferredSlots array", () => {
    expect(() =>
      createSpaceBookingSchema.parse({ ...validData, preferredSlots: [] })
    ).toThrow();
  });

  it("rejects more than 5 slots", () => {
    expect(() =>
      createSpaceBookingSchema.parse({
        ...validData,
        preferredSlots: Array(6).fill("slot"),
      })
    ).toThrow();
  });

  it("rejects purpose shorter than 10 chars", () => {
    expect(() =>
      createSpaceBookingSchema.parse({ ...validData, purpose: "short" })
    ).toThrow();
  });

  it("accepts optional notes", () => {
    const result = createSpaceBookingSchema.parse({ ...validData, notes: "Some note" });
    expect(result.notes).toBe("Some note");
  });

  it("rejects notes over 500 chars", () => {
    expect(() =>
      createSpaceBookingSchema.parse({ ...validData, notes: "x".repeat(501) })
    ).toThrow();
  });
});

// ─── adminLoginSchema ────────────────────────────────────

describe("adminLoginSchema", () => {
  it("accepts valid login", () => {
    const result = adminLoginSchema.parse({
      email: "admin@example.com",
      password: "secret",
    });
    expect(result.email).toBe("admin@example.com");
  });

  it("rejects missing password", () => {
    expect(() =>
      adminLoginSchema.parse({ email: "admin@example.com", password: "" })
    ).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      adminLoginSchema.parse({ email: "bad", password: "secret" })
    ).toThrow();
  });
});

// ─── adminCheckinPassSchema ──────────────────────────────

describe("adminCheckinPassSchema", () => {
  it("accepts valid pass ID format", () => {
    const result = adminCheckinPassSchema.parse({ passId: "OSS-EV-ABCD1234" });
    expect(result.passId).toBe("OSS-EV-ABCD1234");
  });

  it("rejects invalid pass ID format", () => {
    expect(() =>
      adminCheckinPassSchema.parse({ passId: "INVALID-FORMAT" })
    ).toThrow();
  });

  it("rejects lowercase pass ID", () => {
    expect(() =>
      adminCheckinPassSchema.parse({ passId: "OSS-EV-abcd1234" })
    ).toThrow();
  });

  it("rejects empty passId", () => {
    expect(() => adminCheckinPassSchema.parse({ passId: "" })).toThrow();
  });
});
