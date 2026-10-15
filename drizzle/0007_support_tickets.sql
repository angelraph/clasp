CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"email" text NOT NULL,
	"deal_id" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
