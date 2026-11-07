import type { DocumentService, DocumentRevision } from "./document-service.ts";

export async function runDocumentGenerationStep(service: DocumentService): Promise<DocumentRevision | null> {
  return service.runNextGeneration();
}
