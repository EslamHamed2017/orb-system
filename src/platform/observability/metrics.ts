const LABEL = /^[a-z][a-z0-9-]{0,63}$/i;
function label(value: string): string { if (!LABEL.test(value) || /(?:password|secret|token|cookie|authorization)/i.test(value)) throw new TypeError("unsafe metric label"); return value; }
type Outcome = "success" | "failure";
type JobOutcome = "success" | "failed";
export class MetricsRegistry {
  private readonly mutation = new Map<string, Record<Outcome, number[]>>();
  private readonly jobs = new Map<string, Record<JobOutcome, number>>();
  private readonly sends = new Map<string, number>();
  private readonly dependency = new Map<string, 0 | 1>();
  private backupLag = 0; private restores: number[] = []; private auditHealthy: 0 | 1 = 1;
  observeMutation(input: { operationId: string; durationMs: number; outcome: Outcome }): void { const key=label(input.operationId); if (!Number.isFinite(input.durationMs)||input.durationMs<0) throw new RangeError("durationMs must be non-negative"); const row=this.mutation.get(key)??{success:[],failure:[]}; row[input.outcome].push(input.durationMs); this.mutation.set(key,row); }
  recordJob(input: { job: string; outcome: JobOutcome }): void { const key=label(input.job), row=this.jobs.get(key)??{success:0,failed:0}; row[input.outcome]++; this.jobs.set(key,row); }
  recordSendFailure(provider: string): void { const key=label(provider); this.sends.set(key,(this.sends.get(key)??0)+1); }
  setBackupLagMinutes(value: number): void { if (!Number.isFinite(value)||value<0) throw new RangeError("backup lag must be non-negative"); this.backupLag=value; }
  observeRestoreMinutes(value: number): void { if (!Number.isFinite(value)||value<0) throw new RangeError("restore duration must be non-negative"); this.restores.push(value); }
  setAuditChainHealthy(value: boolean): void { this.auditHealthy=value?1:0; }
  setDependencyHealthy(name: string, value: boolean): void { this.dependency.set(label(name),value?1:0); }
  snapshot() { return { mutationLatencyMs:Object.fromEntries(this.mutation), jobRuns:Object.fromEntries(this.jobs), sendFailures:Object.fromEntries(this.sends), backupLagMinutes:this.backupLag, restoreMinutes:[...this.restores], auditChainHealthy:this.auditHealthy, dependencies:Object.fromEntries(this.dependency) }; }
}
