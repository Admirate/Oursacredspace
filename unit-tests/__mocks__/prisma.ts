const mockPrisma: Record<string, any> = {
  adminSession: {
    findUnique: jest.fn(),
    create: jest.fn(),
    // update/delete are invoked fire-and-forget as `...().catch(() => {})`,
    // so they MUST return a promise or the `.catch` access throws.
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  classSession: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  event: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  spaceRequest: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  notificationLog: {
    create: jest.fn(),
  },
  statusHistory: {
    create: jest.fn(),
  },
  contactEnquiry: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  // Backs the DB-based rate limiter (isDbRateLimited). Without these the
  // limiter throws and, by design, denies by default — which surfaced as
  // spurious 429s in tests for login / booking / payment endpoints.
  rateLimitEntry: {
    count: jest.fn(),
    create: jest.fn(),
    // Fire-and-forget cleanup (`...().catch(() => {})`) — must be a promise.
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

export { mockPrisma as prisma };
