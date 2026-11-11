import { z } from "zod";

const required = (name: string) => z.string({ error: `${name} is required` }).trim().min(1, `${name} is required`);

export const RuntimeEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: required("DATABASE_URL"),
  OBJECT_STORAGE_ENDPOINT: required("OBJECT_STORAGE_ENDPOINT"),
  OBJECT_STORAGE_REGION: required("OBJECT_STORAGE_REGION"),
  OBJECT_STORAGE_BUCKET: required("OBJECT_STORAGE_BUCKET"),
  OBJECT_STORAGE_ACCESS_KEY_ID: required("OBJECT_STORAGE_ACCESS_KEY_ID"),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: required("OBJECT_STORAGE_SECRET_ACCESS_KEY"),
  ORB_APP_ORIGIN: required("ORB_APP_ORIGIN"),
  ORB_ALLOWED_ORIGINS: required("ORB_ALLOWED_ORIGINS"),
  AUTH_IDLE_MINUTES: required("AUTH_IDLE_MINUTES"),
  AUTH_ABSOLUTE_MINUTES: required("AUTH_ABSOLUTE_MINUTES"),
  ENCRYPTION_KEY_BASE64: required("ENCRYPTION_KEY_BASE64"),
  TELEMETRY_ENDPOINT: required("TELEMETRY_ENDPOINT"),
  BACKUP_STATUS_ENDPOINT: required("BACKUP_STATUS_ENDPOINT"),
  ORB_REALIGNMENT_DUAL_WRITE: z.enum(["0", "1"]).default("0"),
  ORB_REALIGNMENT_READ_PATH: z.enum(["legacy", "compare", "v2"]).default("legacy"),
});

export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;
