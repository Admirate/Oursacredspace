-- CreateTable: contact_enquiries (additive only, no existing data affected)
CREATE TABLE IF NOT EXISTS "contact_enquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_enquiries_email_idx" ON "contact_enquiries"("email");
CREATE INDEX IF NOT EXISTS "contact_enquiries_created_at_idx" ON "contact_enquiries"("created_at");
