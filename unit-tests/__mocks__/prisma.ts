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
    // Default [] so expireStaleHolds finds nothing to sweep unless a test says so.
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    // Capacity is multi-seat aware: handlers sum `quantity` across active
    // bookings rather than counting rows. createBooking/adminDashboardStats
    // use aggregate; getClasses/getEvents use groupBy. Both need a default —
    // an undefined method throws a synchronous TypeError inside the
    // `Promise.all([...])` in createBooking, which strands the sibling
    // promise as an unhandled rejection and kills the Jest worker.
    aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
    groupBy: jest.fn().mockResolvedValue([]),
    // expireStaleHolds sweeps abandoned PENDING_PAYMENT holds before counting.
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    // verifyPayment reconciles an unconfirmable capture via
    // `updateMany(...).catch(...)` — must be a promise.
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  notificationLog: {
    create: jest.fn(),
  },
  statusHistory: {
    create: jest.fn(),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
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
