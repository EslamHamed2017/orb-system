CREATE TABLE "SystemSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "organization" JSONB NOT NULL,
  "numbering" JSONB NOT NULL,
  "print" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6),
  "updated_by" UUID,
  CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SystemSettings_version_positive" CHECK ("version" > 0)
);
CREATE TABLE "SettingsAuditEvent" (
  "id" UUID NOT NULL DEFAULT orb_uuidv7(),
  "settings_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "reason" TEXT NOT NULL,
  "before_version" INTEGER NOT NULL,
  "after_version" INTEGER NOT NULL,
  "changed_sections" TEXT[] NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  CONSTRAINT "SettingsAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettingsAuditEvent_version_increment" CHECK ("after_version" = "before_version" + 1),
  CONSTRAINT "SettingsAuditEvent_reason_required" CHECK (length(btrim("reason")) >= 8)
);
CREATE UNIQUE INDEX "SettingsAuditEvent_settings_id_after_version_key" ON "SettingsAuditEvent"("settings_id", "after_version");
CREATE INDEX "SettingsAuditEvent_occurred_at_idx" ON "SettingsAuditEvent"("occurred_at");
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SettingsAuditEvent" ADD CONSTRAINT "SettingsAuditEvent_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "SystemSettings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SettingsAuditEvent" ADD CONSTRAINT "SettingsAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "SettingsAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "SettingsAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orb_app') THEN REVOKE UPDATE, DELETE ON "SettingsAuditEvent" FROM orb_app; END IF; END $$;
