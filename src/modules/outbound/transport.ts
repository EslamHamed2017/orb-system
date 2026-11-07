export interface TransportResult { readonly result: "ACCEPTED" | "DELIVERED" | "FAILED" | "UNKNOWN"; readonly providerReference?: string; readonly failureCode?: string }

export function createInMemoryOutboundTransport(results: readonly TransportResult[] = []) {
  const requests: Array<{ manifestId: string; approvalId: string }> = [];
  const captures: Array<Record<string, any>> = [];
  let index = 0;
  return {
    requests, captures,
    async send(request: { manifestId: string; approvalId: string }, capture: Record<string, any>): Promise<TransportResult> {
      requests.push(structuredClone(request)); captures.push(structuredClone(capture));
      return structuredClone(results[index++] ?? { result: "DELIVERED", providerReference: `memory-${index}` });
    },
  };
}
