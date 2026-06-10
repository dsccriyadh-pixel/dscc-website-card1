CREATE TABLE "card_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"visitor_hash" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "share_image_url" text;--> statement-breakpoint
ALTER TABLE "card_views" ADD CONSTRAINT "card_views_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_views_employee_idx" ON "card_views" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "card_views_viewed_at_idx" ON "card_views" USING btree ("viewed_at");