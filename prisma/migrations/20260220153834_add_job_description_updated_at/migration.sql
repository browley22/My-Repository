-- AlterTable
ALTER TABLE "Requisition" ADD COLUMN "jobDescription" TEXT;
ALTER TABLE "Requisition" ADD COLUMN "jobDescriptionUpdatedAt" DATETIME;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "confidence" REAL;
ALTER TABLE "Submission" ADD COLUMN "evaluatedAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "fitScore" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "fitSummary" TEXT;
ALTER TABLE "Submission" ADD COLUMN "gaps" JSONB;
ALTER TABLE "Submission" ADD COLUMN "objectionsAndRebuttals" JSONB;
ALTER TABLE "Submission" ADD COLUMN "sellingPoints" JSONB;
ALTER TABLE "Submission" ADD COLUMN "strengths" JSONB;
