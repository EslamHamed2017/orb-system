import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyCorrectionModel, verifyRepositorySources } from '../../scripts/verify-r1-task-coverage.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const source = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');
const repositorySources = {
  tasks: source('specs/001-orb-trade-operations/tasks.md'),
  openapi: source('specs/001-orb-trade-operations/contracts/openapi.yaml'),
  ui: source('specs/001-orb-trade-operations/contracts/ui-workflows.md'),
  spec: source('specs/001-orb-trade-operations/spec.md'),
  quickstart: source('specs/001-orb-trade-operations/quickstart.md'),
};

test('accepted R1 graph has exact complete coverage, ownership and ordering', () => {
  assert.deepEqual(verifyRepositorySources(repositorySources), {
    tasks: 85, edges: 196, primaryFiles: 408, correctionOverlays: 0,
    operations: 79, requirements: 20, invariants: 7,
    uiRoutes: 21, pageFiles: 22, evidence: 17,
  });
});

test('completed task markers are rejected', () => {
  const tasks = repositorySources.tasks.replace('- [ ] **ORB-R1-0001**', '- [x] **ORB-R1-0001**');
  assert.throws(() => verifyRepositorySources({ ...repositorySources, tasks }), /marked complete/);
});

test('placeholder correction rows cannot become executable tasks', () => {
  const tasks = repositorySources.tasks.replace('## P1 Scaffolding', '- [ ] **ORB-R1-CORR-NNNN** placeholder\n\n## P1 Scaffolding');
  assert.throws(() => verifyRepositorySources({ ...repositorySources, tasks }), /non-concrete correction placeholder/);
});

test('actual page ownership must match the immutable primary map', () => {
  const tasks = repositorySources.tasks.replace('| `src/app/sign-in/page.tsx` | `ORB-R1-0210` |', '| `src/app/sign-in/page.tsx` | `ORB-R1-9999` |');
  assert.throws(() => verifyRepositorySources({ ...repositorySources, tasks }), /page file owner mismatch/);
});

function acceptedCorrectionFixture() {
  return {
    primary: {
      'src/service.ts': 'ORB-R1-0204',
      'tests/service.test.ts': 'ORB-R1-0203',
    },
    corrections: [
      {
        id: 'ORB-R1-CORR-0001', prerequisites: ['ORB-R1-1316', 'ORB-R1-0204', 'ORB-R1-0203'],
        correctsFiles: ['src/service.ts', 'tests/service.test.ts'],
        primaryOwner: { 'src/service.ts': 'ORB-R1-0204', 'tests/service.test.ts': 'ORB-R1-0203' },
        supersedes: { 'src/service.ts': 'none', 'tests/service.test.ts': 'none' },
        exactFiles: ['tests/regression/corr-0001.test.ts'],
        defect: 'DEF-101 stale write bypass', retainedFailingTest: true,
        failingTestPaths: ['tests/service.test.ts'], regressionScope: 'request integrity', impactScope: 'command path only',
        reviews: { security: 'PASS', integrity: 'PASS', contract: 'PASS' },
        approval: { reviewer: 'A. Reviewer', at: '2026-11-19T09:00:00Z', beforeEdit: true },
        changedPaths: ['src/service.ts', 'tests/service.test.ts', 'tests/regression/corr-0001.test.ts'],
      },
      {
        id: 'ORB-R1-CORR-0002', prerequisites: ['ORB-R1-1316', 'ORB-R1-0204', 'ORB-R1-CORR-0001'],
        correctsFiles: ['src/service.ts'], primaryOwner: { 'src/service.ts': 'ORB-R1-0204' },
        supersedes: { 'src/service.ts': 'ORB-R1-CORR-0001' }, exactFiles: [],
        defect: 'DEF-102 retry regression', retainedFailingTest: true,
        failingTestPaths: ['tests/regression/corr-0001.test.ts'], regressionScope: 'retry behavior', impactScope: 'service only',
        reviews: { security: 'PASS', integrity: 'PASS', contract: 'PASS' },
        approval: { reviewer: 'B. Reviewer', at: '2026-11-19T10:00:00Z', beforeEdit: true },
        changedPaths: ['src/service.ts'],
      },
    ],
  };
}

test('reviewed correction overlays and a strictly ordered superseding overlay are accepted', () => {
  const result = verifyCorrectionModel(acceptedCorrectionFixture());
  assert.deepEqual(result, { primaryFiles: 3, correctionOverlays: 3 });
});

const rejected = [
  ['wrong primary owner', (x: any) => { x.corrections[0].primaryOwner['src/service.ts'] = 'ORB-R1-9999'; }, /primary owner/],
  ['wildcard path', (x: any) => { x.corrections[0].correctsFiles[0] = 'src\/*.ts'; }, /literal file path/],
  ['directory path', (x: any) => { x.corrections[0].exactFiles = ['tests/regression/']; }, /literal file path/],
  ['missing approval', (x: any) => { delete x.corrections[0].approval; }, /approval/],
  ['missing retained failing result', (x: any) => { x.corrections[0].retainedFailingTest = false; }, /retained failing test/],
  ['missing exact failing-test path', (x: any) => { x.corrections[0].failingTestPaths = []; }, /failing-test path/],
  ['unknown target', (x: any) => { x.corrections[0].correctsFiles[0] = 'src/unknown.ts'; x.corrections[0].primaryOwner = { 'src/unknown.ts': 'ORB-R1-0204', 'tests/service.test.ts': 'ORB-R1-0203' }; x.corrections[0].supersedes = { 'src/unknown.ts': 'none', 'tests/service.test.ts': 'none' }; }, /unknown overlay target/],
  ['unordered overlap', (x: any) => { x.corrections[1].prerequisites = ['ORB-R1-1316', 'ORB-R1-0204']; }, /prior overlay prerequisite/],
  ['broken supersession', (x: any) => { x.corrections[1].supersedes['src/service.ts'] = 'none'; }, /supersedes/],
  ['overlay-only new file', (x: any) => { x.corrections[0].correctsFiles[0] = 'src/new.ts'; x.corrections[0].primaryOwner = { 'src/new.ts': 'ORB-R1-CORR-0001', 'tests/service.test.ts': 'ORB-R1-0203' }; x.corrections[0].supersedes = { 'src/new.ts': 'none', 'tests/service.test.ts': 'none' }; }, /unknown overlay target/],
  ['undeclared edit', (x: any) => { x.corrections[0].changedPaths.push('src/hidden.ts'); }, /undeclared edit/],
] as const;
for (const [name, mutate, expected] of rejected) test('rejects correction fixture: ' + name, () => {
  const fixture: any = structuredClone(acceptedCorrectionFixture()); mutate(fixture);
  assert.throws(() => verifyCorrectionModel(fixture), expected);
});
