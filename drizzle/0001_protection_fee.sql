ALTER TABLE "deals" ADD COLUMN "fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "paid_out_cents" integer DEFAULT 0 NOT NULL;