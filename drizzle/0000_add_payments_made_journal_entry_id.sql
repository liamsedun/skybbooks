ALTER TABLE "payments_made" ADD COLUMN "journal_entry_id" uuid REFERENCES "journal_entries"("id");
