"use client";

import { LiveAttachments } from "./LiveAttachments";
import type { AttachmentFilters, AttachmentLocale } from "./attachments-index";


/** Gear → Lists → Attachments: every file attached to every project's transactions, read live. */
export function AttachmentsIndexPage({ locale, filters }: Readonly<{ locale: AttachmentLocale; filters: AttachmentFilters }>) {
  return <LiveAttachments locale={locale} search={filters.query ?? ""} {...(filters.projectId ? { projectId: filters.projectId } : {})}/>;
}
