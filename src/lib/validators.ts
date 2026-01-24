import { z } from "zod";

// === Phone Number Validation ===

const phoneRegex = /^\+91\d{10}$/;

export const phoneSchema = z
  .string()
  .min(10, "Phone number is required")
  .transform((val) => {
    // Remove all non-digit characters
    const cleaned = val.replace(/\D/g, "");
    // Handle different formats
    if (cleaned.startsWith("91") && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    return val;
  })
  .refine((val) => phoneRegex.test(val), {
    message: "Please enter a valid 10-digit Indian phone number",
  });

// === Common Schemas ===

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

export const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be less than 100 characters")
  .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces");

// === Booking Schemas ===

export const createClassBookingSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  classSessionId: z.string().uuid("Invalid class session"),
});

export const createEventBookingSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  eventId: z.string().uuid("Invalid event"),
});

export const createSpaceBookingSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  preferredSlots: z
    .array(z.string())
    .min(1, "Please select at least one preferred time slot")
    .max(5, "You can select up to 5 time slots"),
  purpose: z
    .string()
    .min(10, "Please describe the purpose in at least 10 characters")
    .max(500, "Purpose must be less than 500 characters"),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

// === Admin Schemas ===

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const adminUpdateSpaceRequestSchema = z.object({
  spaceRequestId: z.string().uuid("Invalid space request ID"),
  action: z.enum(["approve", "reschedule", "decline", "confirm", "follow_up"]),
  scheduledSlot: z.string().datetime().optional(),
  adminNotes: z.string().max(500).optional(),
});

export const adminCheckinPassSchema = z.object({
  passId: z
    .string()
    .min(1, "Pass ID is required")
    .regex(/^OSS-EV-[A-Z0-9]{8}$/, "Invalid pass ID format"),
});

export const adminCreateClassSessionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
  startsAt: z.string().datetime("Invalid date/time"),
  duration: z.number().min(15).max(480).default(60),
  capacity: z.number().min(1).max(100),
  pricePaise: z.number().min(0),
  active: z.boolean().default(true),
});

export const adminCreateEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(1000).optional(),
  startsAt: z.string().datetime("Invalid date/time"),
  venue: z.string().min(3).max(200),
  pricePaise: z.number().min(0),
  capacity: z.number().min(1).max(1000).optional(),
  active: z.boolean().default(true),
});

// === Export Types ===

export type CreateClassBookingInput = z.infer<typeof createClassBookingSchema>;
export type CreateEventBookingInput = z.infer<typeof createEventBookingSchema>;
export type CreateSpaceBookingInput = z.infer<typeof createSpaceBookingSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminUpdateSpaceRequestInput = z.infer<typeof adminUpdateSpaceRequestSchema>;
export type AdminCheckinPassInput = z.infer<typeof adminCheckinPassSchema>;
export type AdminCreateClassSessionInput = z.infer<typeof adminCreateClassSessionSchema>;
export type AdminCreateEventInput = z.infer<typeof adminCreateEventSchema>;
