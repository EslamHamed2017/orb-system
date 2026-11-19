/** Database projects have UUIDv7 ids (as on the overview page); browser-only projects keep their own pages. */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isSavedProjectId = (id: string) => UUID_V7.test(id);
