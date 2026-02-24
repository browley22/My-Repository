-- Add contact fields and manual override flag to Candidate
ALTER TABLE "Candidate" ADD COLUMN "email" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "phone" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "contactManuallyOverridden" BOOLEAN NOT NULL DEFAULT 0;
