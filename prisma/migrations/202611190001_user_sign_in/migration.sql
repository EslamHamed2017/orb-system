-- Real password sign-in: one credential per user, plus an append-only access audit trail.
CREATE TABLE "UserCredential" (
 "user_id" UUID NOT NULL,
 "login" TEXT NOT NULL,
 "password_hash" TEXT NOT NULL,
 "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "must_change_password" BOOLEAN NOT NULL DEFAULT false,
 "failed_attempts" INTEGER NOT NULL DEFAULT 0,
 "locked_until" TIMESTAMPTZ(6),
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("user_id"),
 CONSTRAINT "UserCredential_login_normalized" CHECK ("login" = lower(btrim("login")) AND length("login") BETWEEN 3 AND 254),
 CONSTRAINT "UserCredential_hash_format" CHECK ("password_hash" LIKE 'scrypt$%'),
 CONSTRAINT "UserCredential_failed_attempts_range" CHECK ("failed_attempts" >= 0)
);
CREATE UNIQUE INDEX "UserCredential_login_key" ON "UserCredential"("login");
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "AccessAuditEvent" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(),
 "tenant_id" UUID NOT NULL,
 "actor_id" UUID,
 "subject_user_id" UUID NOT NULL,
 "action" TEXT NOT NULL,
 "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT "AccessAuditEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AccessAuditEvent_action_allowed" CHECK ("action" IN ('USER_CREATED','USER_UPDATED','USER_SUSPENDED','USER_REACTIVATED','ROLES_REPLACED','PASSWORD_SET','PASSWORD_CHANGED','SESSION_REVOKED','SIGN_IN_SUCCEEDED','SIGN_IN_LOCKED','SIGNED_OUT'))
);
CREATE INDEX "AccessAuditEvent_tenant_id_occurred_at_idx" ON "AccessAuditEvent"("tenant_id", "occurred_at");
CREATE INDEX "AccessAuditEvent_subject_user_id_idx" ON "AccessAuditEvent"("subject_user_id");
ALTER TABLE "AccessAuditEvent" ADD CONSTRAINT "AccessAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "AccessAuditEvent" ADD CONSTRAINT "AccessAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "AccessAuditEvent" ADD CONSTRAINT "AccessAuditEvent_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "AccessAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AccessAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
