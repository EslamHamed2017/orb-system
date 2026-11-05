import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = resolve(ROOT, 'specs/001-orb-trade-operations');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
function text(path) { return readFileSync(resolve(BASE, path), 'utf8'); }
function pythonPreflight() {
  let versions;
  try { versions = JSON.parse(execFileSync('python3', ['-c', 'import json,platform,yaml;print(json.dumps({"python":platform.python_version(),"pyyaml":yaml.__version__}))'], { encoding: 'utf8' })); }
  catch (error) { throw new Error('Traceability tests require executable python3 with PyYAML 6.0.1: ' + error.message); }
  assert.match(versions.python, /^3\.12\./, 'python3 must be pinned to Python 3.12.x');
  assert.equal(versions.pyyaml, '6.0.1', 'PyYAML must be pinned to 6.0.1');
}
function parseYaml(path) {
  pythonPreflight();
  const code = 'import json,sys,yaml\nwith open(sys.argv[1],encoding="utf-8") as f:v=yaml.safe_load(f)\nprint(json.dumps(v,separators=(",",":"),default=str))';
  return JSON.parse(execFileSync('python3', ['-c', code, path], { encoding: 'utf8' }));
}
function section(source, start, end) {
  const from = source.indexOf(start); assert.notEqual(from, -1, 'missing section: ' + start);
  const to = end ? source.indexOf(end, from + start.length) : source.length; assert.notEqual(to, -1, 'missing section terminator: ' + end);
  return source.slice(from, to);
}
function splitRow(line) {
  const cells = []; let cell = '', inCode = false;
  for (const char of line.slice(1, line.lastIndexOf('|'))) {
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode) { cells.push(cell.trim()); cell = ''; } else cell += char;
  }
  cells.push(cell.trim()); return cells;
}
function rows(source) {
  return source.split(/\r?\n/).filter((line) => /^\|.*\|\s*$/.test(line) && !/^\|\s*:?-+/.test(line)).map(splitRow);
}
function backticks(cell) { return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]); }
function assertExactInventory(actual, expected, label) {
  const counts = new Map(); for (const value of actual) counts.set(value, (counts.get(value) || 0) + 1);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !counts.has(value));
  const unknown = [...counts.keys()].filter((value) => !expectedSet.has(value));
  const duplicate = [...counts].filter(([, count]) => count !== 1).map(([value, count]) => value + '×' + count);
  assert.deepEqual({ missing, unknown, duplicate }, { missing: [], unknown: [], duplicate: [] }, label);
}
function operationIds() {
  const api = parseYaml(resolve(BASE, 'contracts/openapi.yaml')), ids = [];
  for (const item of Object.values(api.paths || {})) for (const [method, operation] of Object.entries(item || {}))
    if (METHODS.has(method.toLowerCase())) ids.push(operation.operationId);
  return ids;
}
const TASK_OP_START = '### OperationId to implementation/verification tasks (79/79)';
const TASK_REQ_START = '### Requirement/invariant mapping (20/20 + 7/7)';
const TASK_UI_START = '### UI route mapping and actual page ownership (21/21)';
const TASK_E_START = '### Numbered evidence mapping (17/17; deployed runtime only)';
const QUICK_MATRIX_START = '## Requirement, invariant, and numbered evidence matrix';
const QUICK_OP_START = '### Complete supporting-operation acceptance inventory';
function taskOperationRows(source) { return rows(section(source, TASK_OP_START, TASK_REQ_START)).slice(1).map((row) => backticks(row[0])[0]).filter(Boolean); }
function quickOperationTokens(source) { return rows(section(source, QUICK_OP_START, '## Milestone evidence realism')).slice(1).flatMap((row) => backticks(row[1] || '')); }
function requirementRows(source, start, end) { return rows(section(source, start, end)).slice(1).map((row) => row[0]); }
function uiContractRoutes(source) { return rows(section(source, '## Exact screen map', '## Common interaction contract')).slice(1).map((row) => backticks(row[0])[0]); }
function taskRoutes(source) { return rows(section(source, TASK_UI_START, TASK_E_START)).slice(1).map((row) => backticks(row[1])[0]); }
function evidenceRows(source) { return rows(section(source, TASK_E_START, '## Dependency and parallel execution rules')).slice(1).map((row) => row[0]); }
function quickEvidenceSet(source) {
  const result = new Set();
  for (const match of source.matchAll(/\bE(\d{2})(?:[–-]E?(\d{2}))?\b/g)) {
    const from = Number(match[1]), to = Number(match[2] || match[1]);
    for (let n = from; n <= to; n++) result.add('E' + String(n).padStart(2, '0'));
  }
  return [...result].sort();
}
function verifyOperationMappings(taskSource, quickSource, ids) {
  assertExactInventory(taskOperationRows(taskSource), ids, 'tasks operationId rows must exactly cover OpenAPI');
  assertExactInventory(quickOperationTokens(quickSource), ids, 'quickstart operation inventory must exactly cover OpenAPI');
}
const tasks = text('tasks.md'), quickstart = text('quickstart.md'), spec = text('spec.md'), ui = text('contracts/ui-workflows.md');
const ids = operationIds();
const requirements = Array.from({ length: 20 }, (_, i) => 'R1-' + String(i + 1).padStart(3, '0'));
const invariants = Array.from({ length: 7 }, (_, i) => 'INV-' + String(i + 1).padStart(2, '0'));
const evidence = Array.from({ length: 17 }, (_, i) => 'E' + String(i + 1).padStart(2, '0'));

test('all accepted contract artifacts exist', () => {
  for (const file of ['contracts/openapi.yaml', 'contracts/problem-details.md', 'contracts/ui-workflows.md']) assert.ok(existsSync(resolve(BASE, file)), 'missing accepted contract: ' + file);
});
test('tasks and quickstart exactly map all 79 operationIds', () => {
  assertExactInventory(ids, ids, 'OpenAPI operationIds must be unique'); verifyOperationMappings(tasks, quickstart, ids);
});
test('tasks and quickstart have exact R1 and INV row inventories', () => {
  const expected = [...requirements, ...invariants];
  assertExactInventory(requirementRows(tasks, TASK_REQ_START, TASK_UI_START), expected, 'tasks R1/INV rows');
  assertExactInventory(requirementRows(quickstart, QUICK_MATRIX_START, QUICK_OP_START), expected, 'quickstart R1/INV rows');
  assert.match(spec, /\*\*R1-001\*\* through \*\*R1-014\*\* are exactly/);
  for (const id of [...requirements.slice(14), ...invariants]) assert.match(spec, new RegExp('(^|[^A-Za-z0-9_-])' + id + '([^A-Za-z0-9_-]|$)', 'm'));
});
test('the exact 21 UI route patterns are canonical in contract and tasks', () => {
  const routes = uiContractRoutes(ui); assert.equal(routes.length, 21); assertExactInventory(taskRoutes(tasks), routes, 'task UI routes');
  assert.match(quickstart, /All active routes/); assert.match(spec, /contracts\/ui-workflows\.md/);
});
test('evidence inventory is exactly E01 through E17', () => {
  assertExactInventory(evidenceRows(tasks), evidence, 'tasks evidence rows');
  assert.deepEqual(quickEvidenceSet(quickstart), evidence, 'quickstart evidence references');
});
test('deletion, typo, duplicate, and substring decoy traceability mutations fail closed', () => {
  const id = ids[0];
  const deletedTasks = tasks.replace(new RegExp('^\\| `' + id + '` .*\\n', 'm'), '');
  assert.throws(() => verifyOperationMappings(deletedTasks, quickstart, ids), /tasks operationId rows/);
  const typoQuick = quickstart.replace('`' + id + '`', '`' + id + 'Typo`');
  assert.throws(() => verifyOperationMappings(tasks, typoQuick, ids), /quickstart operation inventory/);
  const duplicateTasks = tasks.replace('| `' + id + '` |', '| `' + id + '` |\n| `' + id + '` | duplicate |');
  assert.throws(() => verifyOperationMappings(duplicateTasks, quickstart, ids), /tasks operationId rows/);
  const decoyQuick = quickstart.replace('`' + id + '`', '`prefix' + id + 'suffix`');
  assert.throws(() => verifyOperationMappings(tasks, decoyQuick, ids), /quickstart operation inventory/);
});
