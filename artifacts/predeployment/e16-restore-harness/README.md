# E16 backup and isolated-restore harness (predeployment)

The `backup` and `restore` adapters must exercise a real paired database backup and object snapshot against the recorded deployed target. Backup must identify both snapshots, prove encryption and a separate copy, and report RPO no greater than 15 minutes.

Restore must use that exact pair in a non-production environment, report RTO no greater than four hours, and verify rows/versions, hashes, allocations, approvals, audit chain, and object links. Production-like targets, mismatched IDs, missing evidence, threshold breaches, or false/missing integrity results fail closed.

```sh
ops/acceptance/run-prebeta-gates.sh --self-test
```

The self-test creates disposable passing/failing adapters and verifies scan, audit, backup-RPO, and restore-link failures emit no manifest. The repository primitives are `ops/backup/backup.sh` and `ops/backup/restore-isolated.sh`; deployment adapters may orchestrate them but must independently report restored linkage. This harness is diagnostic only and earns neither E16 nor E17.
