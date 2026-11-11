import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { changedPathsFromGit, parseGitNameStatus, verifyCorrectionModel, verifyRepositorySources, verifyTaskChangeAuthorization } from '../../scripts/verify-r1-task-coverage.mjs';

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
    operations: 111, requirements: 20, invariants: 7,
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

test('canonical acceptance mappings reject unknown task IDs', () => {
  const tasks = repositorySources.tasks.replace(
    '| `listMasterRecords` | `ORB-R1-0001`,',
    '| `listMasterRecords` | `ORB-R1-9999`,',
  );
  assert.throws(() => verifyRepositorySources({ ...repositorySources, tasks }), /unknown mapped task/);
});

test('actual changed paths are authorized by the selected task primary ownership', () => {
  assert.deepEqual(
    verifyTaskChangeAuthorization(repositorySources.tasks, 'ORB-R1-0002', [
      'scripts/verify-r1-task-coverage.mjs',
      'tests/contract/task-coverage.test.ts',
    ]),
    { taskId: 'ORB-R1-0002', changedPaths: 2 },
  );
});

test('actual changed paths reject another task owner and unowned files', () => {
  assert.throws(
    () => verifyTaskChangeAuthorization(repositorySources.tasks, 'ORB-R1-0002', ['src/app/page.tsx']),
    /unauthorized changed path.*ORB-R1-1212/,
  );
  assert.throws(
    () => verifyTaskChangeAuthorization(repositorySources.tasks, 'ORB-R1-0002', ['src/hidden.ts']),
    /unauthorized changed path.*unowned/,
  );
});

test('actual changed paths reject missing, duplicate and non-literal inputs', () => {
  assert.throws(() => verifyTaskChangeAuthorization(repositorySources.tasks, 'ORB-R1-0002', []), /no actual changed paths/);
  assert.throws(() => verifyTaskChangeAuthorization(repositorySources.tasks, 'ORB-R1-0002', ['tests/contract/task-coverage.test.ts', 'tests/contract/task-coverage.test.ts']), /duplicate actual changed paths/);
  assert.throws(() => verifyTaskChangeAuthorization(repositorySources.tasks, 'ORB-R1-0002', ['src/*.ts']), /literal file path/);
});

test('Git name-status parsing retains both rename/copy paths and every change kind', () => {
  assert.deepEqual(
    parseGitNameStatus('R100\0src/old.ts\0src/new.ts\0C090\0src/base.ts\0src/copy.ts\0T\0src/type.ts\0D\0src/deleted.ts\0A\0src/added.ts\0M\0src/modified.ts\0U\0src/unmerged.ts\0X\0src/unknown.ts\0B\0src/broken.ts\0'),
    ['src/old.ts', 'src/new.ts', 'src/base.ts', 'src/copy.ts', 'src/type.ts', 'src/deleted.ts', 'src/added.ts', 'src/modified.ts', 'src/unmerged.ts', 'src/unknown.ts', 'src/broken.ts'],
  );
  assert.throws(() => parseGitNameStatus('R100\0src/old.ts\0'), /malformed Git name-status/);
  assert.throws(() => parseGitNameStatus('Z\0src/hidden.ts\0'), /unsupported Git change status/);
});

test('Git manifest construction detects copies and uses stable staged or merge-base ranges', () => {
  const calls: string[][] = [];
  const execute = (_command: string, args: string[]) => { calls.push(args); return 'M\0tests/contract/task-coverage.test.ts\0'; };
  assert.deepEqual(changedPathsFromGit(ROOT, ['--task', 'ORB-R1-0002', '--staged'], execute), {
    taskId: 'ORB-R1-0002', paths: ['tests/contract/task-coverage.test.ts'],
  });
  assert.deepEqual(changedPathsFromGit(ROOT, ['--task', 'ORB-R1-0002', '--changed-from', 'origin/main'], execute), {
    taskId: 'ORB-R1-0002', paths: ['tests/contract/task-coverage.test.ts'],
  });
  for (const args of calls) assert.ok(args.includes('--find-copies-harder'));
  assert.deepEqual(calls[0].slice(-2), ['--cached', '--']);
  assert.deepEqual(calls[1].slice(-2), ['origin/main...HEAD', '--']);
});

test('CLI requires explicit graph-only or task-bound actual-change authorization', () => {
  const script = resolve(ROOT, 'scripts/verify-r1-task-coverage.mjs');
  const missing = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /requires --graph-only or --task/);
  const ambiguous = spawnSync(process.execPath, [script, '--graph-only', '--task', 'ORB-R1-0002', '--staged'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /cannot be combined/);
});

test('Git manifest arguments reject conflicts, duplicates, missing values, unknown options and empty diffs', () => {
  const execute = () => '';
  for (const args of [
    ['--task', 'ORB-R1-0002'],
    ['--task'],
    ['--task', 'ORB-R1-0002', '--task', 'ORB-R1-0002', '--staged'],
    ['--task', 'ORB-R1-0002', '--staged', '--changed-from', 'HEAD^'],
    ['--task', 'ORB-R1-0002', '--changed-from'],
    ['--unknown'],
  ]) assert.throws(() => changedPathsFromGit(ROOT, args, execute));
  const empty = changedPathsFromGit(ROOT, ['--task', 'ORB-R1-0002', '--staged'], execute);
  assert.deepEqual(empty, { taskId: 'ORB-R1-0002', paths: [] });
  assert.throws(() => verifyTaskChangeAuthorization(repositorySources.tasks, empty.taskId, empty.paths), /no actual changed paths/);
});

test('task-source correction authorization accepts reviewed overlay targets and correction-created files', () => {
  const correction = `
- [ ] **ORB-R1-CORR-0001** correction fixture
  - **Prerequisites**: \`ORB-R1-1316\`, \`ORB-R1-1212\`.
  - **Exact files**: \`tests/regression/corr-0001.test.ts\`.
  - **Corrects files**: \`src/app/page.tsx\`.
  - **Primary owner**: \`src/app/page.tsx -> ORB-R1-1212\`.
  - **Supersedes**: \`src/app/page.tsx -> none\`.
  - **Defect / reason**: DEF-101.
  - **Failing test evidence**: retained failing fail-before-edit \`tests/contract/task-coverage.test.ts\`.
  - **Focused regression**: task source path.
  - **Impact scope**: fixture only.
  - **Security review**: PASS.
  - **Integrity review**: PASS.
  - **Contract review**: PASS.
  - **Reviewer approval**: A. Reviewer approved before edit.
  - **Changed paths**: \`src/app/page.tsx\`, \`tests/regression/corr-0001.test.ts\`.
`;
  assert.deepEqual(
    verifyTaskChangeAuthorization(repositorySources.tasks + correction, 'ORB-R1-CORR-0001', ['src/app/page.tsx', 'tests/regression/corr-0001.test.ts']),
    { taskId: 'ORB-R1-CORR-0001', changedPaths: 2 },
  );
  const duplicateOwner = correction.replace(
    '`src/app/page.tsx -> ORB-R1-1212`.',
    '`src/app/page.tsx -> ORB-R1-1212`, `src/app/page.tsx -> ORB-R1-1212`.',
  );
  assert.throws(
    () => verifyTaskChangeAuthorization(repositorySources.tasks + duplicateOwner, 'ORB-R1-CORR-0001', ['src/app/page.tsx', 'tests/regression/corr-0001.test.ts']),
    /duplicate Primary owner mapping/,
  );
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
