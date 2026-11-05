const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = resolve(__dirname, '../..');
const BASE = resolve(ROOT, 'specs/001-orb-trade-operations');
const BT = String.fromCharCode(96);

function text(path) { return readFileSync(resolve(BASE, path), 'utf8'); }
function parseYaml(path) {
  const program = 'import json,sys,yaml\nprint(json.dumps(yaml.safe_load(open(sys.argv[1],encoding="utf-8")),default=str))';
  return JSON.parse(execFileSync('python3', ['-c', program, path], { encoding: 'utf8' }));
}
function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, 'missing section: ' + start);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  assert.notEqual(to, -1, 'missing section terminator: ' + end);
  return source.slice(from, to);
}
function firstColumnValues(source) {
  const values = new Set();
  for (const line of source.split(/\r?\n/)) {
    const firstTick = line.indexOf(BT);
    const secondTick = firstTick < 0 ? -1 : line.indexOf(BT, firstTick + 1);
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length > 2 && /^(R1-\d{3}|INV-\d{2}|E\d{2})$/.test(cells[1])) {
      values.add(cells[1]);
    } else if (firstTick >= 0 && secondTick > firstTick && line.trimStart().startsWith('|')) {
      values.add(line.slice(firstTick + 1, secondTick));
    }
  }
  return values;
}
function operationIds() {
  const api = parseYaml(resolve(BASE, 'contracts/openapi.yaml'));
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
  return Object.values(api.paths).flatMap((pathItem) => Object.entries(pathItem)
    .filter(([method]) => methods.has(method.toLowerCase()))
    .map(([, operation]) => operation.operationId));
}
function missingWords(source, expected) {
  return expected.filter((word) => !new RegExp('(^|[^A-Za-z0-9_])' + word + '([^A-Za-z0-9_]|$)').test(source));
}
function verifyOperationMappings(tasks, quickstart, ids) {
  const taskMap = section(tasks, '### OperationId to implementation/verification tasks (79/79)', '### Requirement/invariant mapping');
  const quickMap = section(quickstart, '### Complete supporting-operation acceptance inventory', '## Milestone evidence realism');
  const taskRows = firstColumnValues(taskMap);
  assert.deepEqual(ids.filter((id) => !taskRows.has(id)), [], 'tasks canonical operation rows are incomplete');
  assert.deepEqual(missingWords(quickMap, ids), [], 'quickstart operation inventory is incomplete');
}

const tasks = text('tasks.md');
const quickstart = text('quickstart.md');
const spec = text('spec.md');
const ui = text('contracts/ui-workflows.md');
const ids = operationIds();
const requirements = Array.from({ length: 20 }, (_, index) => 'R1-' + String(index + 1).padStart(3, '0'));
const invariants = Array.from({ length: 7 }, (_, index) => 'INV-' + String(index + 1).padStart(2, '0'));
const evidence = Array.from({ length: 17 }, (_, index) => 'E' + String(index + 1).padStart(2, '0'));

test('all accepted contract artifacts exist', () => {
  for (const file of ['contracts/openapi.yaml', 'contracts/problem-details.md', 'contracts/ui-workflows.md']) {
    assert.ok(existsSync(resolve(BASE, file)), 'missing accepted contract: ' + file);
  }
});

test('tasks and quickstart map every accepted operationId', () => {
  assert.equal(ids.length, 79);
  assert.equal(new Set(ids).size, 79);
  verifyOperationMappings(tasks, quickstart, ids);
});

test('requirement and invariant mappings cover R1-001..020 and INV-01..07', () => {
  const expected = [...requirements, ...invariants];
  const quickRows = firstColumnValues(section(quickstart, '## Requirement, invariant, and numbered evidence matrix', '### Complete supporting-operation acceptance inventory'));
  const taskRows = firstColumnValues(section(tasks, '### Requirement/invariant mapping (20/20 + 7/7)', '### UI route mapping'));
  assert.deepEqual(expected.filter((id) => !quickRows.has(id)), []);
  assert.deepEqual(expected.filter((id) => !taskRows.has(id)), []);
  assert.ok(spec.includes('**R1-001** through **R1-014** are exactly'));
  assert.deepEqual(missingWords(spec, requirements.slice(14)), []);
  assert.deepEqual(missingWords(spec, invariants), []);
});

test('the exact 21 UI route patterns are canonically mapped', () => {
  const routeContract = section(ui, '## Exact screen map', '## Common interaction contract');
  const routes = [...firstColumnValues(routeContract)];
  assert.equal(routes.length, 21);
  const taskRoutes = firstColumnValues(section(tasks, '### UI route mapping and actual page ownership (21/21)', '### Numbered evidence mapping'));
  assert.deepEqual(routes.filter((route) => !taskRoutes.has(route)), []);
  assert.match(quickstart, /All active routes/);
  assert.match(spec, /contracts\/ui-workflows\.md/);
});

test('numbered acceptance evidence is mapped from E01 through E17', () => {
  const taskEvidence = firstColumnValues(section(tasks, '### Numbered evidence mapping (17/17; deployed runtime only)', '## Dependency and parallel execution rules'));
  assert.deepEqual(evidence.filter((id) => !taskEvidence.has(id)), []);
  assert.deepEqual(missingWords(quickstart, evidence), []);
});

test('negative traceability omission fixture is rejected', () => {
  const omitted = quickstart.replace(ids[0], 'OMITTED_OPERATION');
  assert.throws(() => verifyOperationMappings(tasks, omitted, ids), /quickstart operation inventory is incomplete/);
});
