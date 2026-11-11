import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseYaml } from './openapi-contract.test.ts';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = resolve(ROOT, 'specs/001-orb-trade-operations');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
function text(path) { return readFileSync(resolve(BASE, path), 'utf8'); }
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
  const api = parseYaml(text('contracts/openapi.yaml')), ids = [];
  for (const item of Object.values(api.paths || {})) for (const [method, operation] of Object.entries(item || {}))
    if (METHODS.has(method.toLowerCase())) ids.push(operation.operationId);
  return ids;
}
const TASK_OP_START = '### OperationId to implementation/verification tasks (94/94)';
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
function evidenceTokens(cell, label) {
  const tokens = [];
  for (const match of cell.matchAll(/(?<![A-Za-z0-9])E(\d{2})(?:[–-]E?(\d{2}))?(?![A-Za-z0-9])/g)) {
    const from = Number(match[1]), to = Number(match[2] || match[1]);
    assert.ok(to >= from && to - from < 30, label + ': invalid evidence range ' + match[0]);
    for (let n = from; n <= to; n++) tokens.push('E' + String(n).padStart(2, '0'));
  }
  assert.ok(tokens.length, label + ': missing evidence cell tokens');
  assertExactInventory(tokens, [...new Set(tokens)], label + ': duplicate evidence token');
  for (const token of tokens) assert.ok(/^E(?:0[1-9]|1[0-7])$/.test(token), label + ': unknown evidence ' + token);
  return tokens.sort();
}
const EXPECTED_MATRIX_EVIDENCE = Object.freeze({
  'R1-001': ['E03','E04'], 'R1-002': ['E05','E06'], 'R1-003': ['E07'], 'R1-004': ['E08','E09'],
  'R1-005': ['E10'], 'R1-006': ['E11'], 'R1-007': ['E12'], 'R1-008': ['E13'], 'R1-009': ['E14'],
  'R1-010': ['E15','E16','E17'], 'R1-011': ['E13'], 'R1-012': ['E14'], 'R1-013': ['E08','E15'],
  'R1-014': ['E02','E15','E16','E17'], 'R1-015': ['E06','E07','E16'], 'R1-016': ['E05','E06','E13','E14'],
  'R1-017': ['E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E15','E16'],
  'R1-018': ['E02','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E16'],
  'R1-019': ['E10','E12'], 'R1-020': ['E02','E13'], 'INV-01': ['E05','E06'], 'INV-02': ['E10'],
  'INV-03': ['E11'], 'INV-04': ['E13'], 'INV-05': ['E14'], 'INV-06': ['E09'], 'INV-07': ['E02'],
});
const EXPECTED_MATRIX_EVIDENCE_CELLS = Object.freeze({
  "R1-001": "E03–E04: masters, atomic Project/contract, amendment, zero tolerances, self-approval denial",
  "R1-002": "E05–E06: strict fields, every state, history/hash/approval invalidation, tolerance and stale/replay",
  "R1-003": "E07: all routes, typed metadata/hash verification, audited access, closure blocker",
  "R1-004": "E08–E09: shared dataset, immutable outputs/body/attachments, byte comparison, drift/failure attempts",
  "R1-005": "E10: advances, partial allocation, compensating reversal and exact balance/closure recomputation",
  "R1-006": "E11: proof, exact approval, old/new links and recomputation",
  "R1-007": "E12: currency partitions, sources and four reconciled measures",
  "R1-008": "E13: terminal bypass denial and approved exact outcome apply",
  "R1-009": "E14: financial/final prerequisites, invalidation and reopening",
  "R1-010": "E15–E17: role shaping, exact sessions, bilingual parity, restore",
  "R1-011": "E13: outcome recording only; forbidden settlement automation absent",
  "R1-012": "E14: automatic financial close/reopen independent from Final Close",
  "R1-013": "E08, E15: output language and zero journey divergence",
  "R1-014": "E02, E15–E17: least privilege, immutable audit/evidence, encryption and restore",
  "R1-015": "E06–E07, E16: uniqueness, hashes and append-only evidence",
  "R1-016": "E05–E06, E13–E14: legal/illegal transitions and RFC 9457",
  "R1-017": "E02–E16: operation/UI execution sweep",
  "R1-018": "E02, E04–E14, E16: idempotency, CSRF and current If-Match",
  "R1-019": "E10, E12: exact decimal/currency reconciliation",
  "R1-020": "E02, E13: deferred endpoints/schemas/controls absent",
  "INV-01": "E05–E06: reachable graphs, actor/time/reason/evidence, approval expiry",
  "INV-02": "E10: append-only serializable settlement and closure recalculation",
  "INV-03": "E11: cancellation plus linked replacement; no destructive edit/delete",
  "INV-04": "E13: proposal/decision/apply sequence; rejection is not claim terminal state",
  "INV-05": "E14: snapshot blockers, eligible exceptions, invalidation and fresh assessment",
  "INV-06": "E09: exact stored output/body/attachment bytes and immutable attempts",
  "INV-07": "E02: deferred-scope crawl and 404/schema absence",
});
function normalizedEvidenceCell(cell) { return cell.trim().replace(/\s+/g, ' '); }
function quickMatrixEvidence(source) {
  const matrix = rows(section(source, QUICK_MATRIX_START, QUICK_OP_START)).slice(1), result = Object.create(null);
  for (const row of matrix) {
    assert.equal(row.length, 4, 'quickstart matrix row must have four cells'); const id = row[0];
    assert.ok(!Object.hasOwn(result, id), 'duplicate quickstart matrix row ' + id);
    const cell = row[3] || '', tokens = evidenceTokens(cell, 'quickstart matrix ' + id);
    assert.equal(normalizedEvidenceCell(cell), normalizedEvidenceCell(EXPECTED_MATRIX_EVIDENCE_CELLS[id] || ''), 'quickstart matrix canonical evidence cell for ' + id);
    result[id] = tokens;
  }
  return result;
}
function assertQuickMatrix(source) {
  const actual = quickMatrixEvidence(source), expectedKeys = Object.keys(EXPECTED_MATRIX_EVIDENCE);
  assertExactInventory(Object.keys(actual), expectedKeys, 'quickstart matrix row keys');
  for (const id of expectedKeys) assert.deepEqual(actual[id], [...EXPECTED_MATRIX_EVIDENCE[id]].sort(), 'quickstart matrix evidence for ' + id);
}
function quickEvidenceDefinitions(source) {
  const definitions = section(source, '## E01 — Blocking preconditions', QUICK_MATRIX_START), found = [];
  for (const line of definitions.split(/\r?\n/)) {
    let match = line.match(/^## (E\d{2})\b/) || line.match(/^\*\*(E\d{2})\.\*\*/); if (match) found.push(match[1]);
  }
  return found;
}
function taskRequirementSnapshot(source) {
  return rows(section(source, TASK_REQ_START, TASK_UI_START)).slice(1).map((row) => [row[0], backticks(row[1] || '')]);
}
const EXPECTED_ROUTES = Object.freeze([
  '/', '/admin/{users|backup}', '/approvals', '/documents/{id}', '/evidence/{id}',
  '/masters/{customers|suppliers|coffee|currencies|expense-categories}', '/projects', '/projects/new',
  '/projects/{id}/audit', '/projects/{id}/claims', '/projects/{id}/closure', '/projects/{id}/contracts',
  '/projects/{id}/expenses', '/projects/{id}/money', '/projects/{id}/overview', '/projects/{id}/profit',
  '/projects/{id}/shipments', '/projects/{id}/statements', '/sales-shipments/{id}', '/sign-in', '/supplier-shipments/{id}',
]);

function mutateQuickMatrix(source, mutate) {
  const from = source.indexOf(QUICK_MATRIX_START), to = source.indexOf(QUICK_OP_START, from);
  assert.ok(from >= 0 && to > from, 'canonical quickstart matrix missing');
  const changed = source.slice(from, to).split(/\r?\n/).map((line) => {
    if (!/^\|.*\|\s*$/.test(line) || /^\|\s*:?-+/.test(line)) return line;
    const cells = splitRow(line); if (!/^(?:R1-\d{3}|INV-\d{2})$/.test(cells[0] || '')) return line;
    const result = mutate([...cells]); return '| ' + result.join(' | ') + ' |';
  }).join('\n');
  return source.slice(0, from) + changed + source.slice(to);
}
function assertTaskRequirementMapping(source) {
  assert.equal(createHash('sha256').update(JSON.stringify(taskRequirementSnapshot(source))).digest('hex'), '3108830ff830c72cc699b479a0d672bbad56ff53817fd55fd0d527ee958d67f9', 'tasks R1/INV task-cell mapping changed');
}
function taskEvidenceSnapshot(source) { return rows(section(source, TASK_E_START, '## Dependency and parallel execution rules')).slice(1); }
function assertTaskEvidenceMapping(source) {
  assert.equal(createHash('sha256').update(JSON.stringify(taskEvidenceSnapshot(source))).digest('hex'), 'e4947337de61899b54492418f1d18f1e0f831ce5f023d97755792330f6d253da', 'tasks E01-E17 mapping changed');
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
test('tasks and quickstart exactly map all 105 operationIds', () => {
  assertExactInventory(ids, ids, 'OpenAPI operationIds must be unique'); verifyOperationMappings(tasks, quickstart, ids);
});
test('tasks and quickstart have exact R1 and INV row inventories and mappings', () => {
  const expected = [...requirements, ...invariants];
  assertExactInventory(requirementRows(tasks, TASK_REQ_START, TASK_UI_START), expected, 'tasks R1/INV rows');
  assertTaskRequirementMapping(tasks);
  assertQuickMatrix(quickstart);
  assert.match(spec, /\*\*R1-001\*\* through \*\*R1-014\*\* are exactly/);
  for (const id of [...requirements.slice(14), ...invariants]) assert.match(spec, new RegExp('(^|[^A-Za-z0-9_-])' + id + '([^A-Za-z0-9_-]|$)', 'm'));
});
test('the exact 21 UI route patterns are independently canonical in contract and tasks', () => {
  assert.deepEqual([...EXPECTED_ROUTES].sort(), [...EXPECTED_ROUTES], 'expected route fixture must stay sorted');
  const routes = uiContractRoutes(ui); assertExactInventory(routes, EXPECTED_ROUTES, 'UI contract routes'); assertExactInventory(taskRoutes(tasks), EXPECTED_ROUTES, 'task UI routes');
  assert.match(quickstart, /All active routes/); assert.match(spec, /contracts\/ui-workflows\.md/);
});
test('evidence definitions and tasks inventory are independently exactly E01 through E17', () => {
  assertExactInventory(evidenceRows(tasks), evidence, 'tasks evidence rows'); assertTaskEvidenceMapping(tasks);
  assertExactInventory(quickEvidenceDefinitions(quickstart), evidence, 'quickstart evidence definitions');
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


test('synchronized route substitutions, duplicates and one-sided drift fail the independent canonical inventory', () => {
  const changedUi = ui.replace('| `/projects` |', '| `/portfolios` |');
  const changedTasks = tasks.replace('| `/projects` |', '| `/portfolios` |');
  assert.throws(() => assertExactInventory(uiContractRoutes(changedUi), EXPECTED_ROUTES, 'UI contract routes'), /UI contract routes/);
  assert.throws(() => assertExactInventory(taskRoutes(changedTasks), EXPECTED_ROUTES, 'task UI routes'), /task UI routes/);
  const duplicateUi = ui.replace('| `/projects` |', '| `/projects` |\n| `/projects` | Duplicate | none |');
  assert.throws(() => assertExactInventory(uiContractRoutes(duplicateUi), EXPECTED_ROUTES, 'UI contract routes'), /duplicate/);
});

test('quickstart matrix evidence mapping rejects missing, duplicate, wrong, unknown and decoy evidence', () => {
  const removed = mutateQuickMatrix(quickstart, (cells) => { cells[3] = 'No retained proof in this matrix cell'; return cells; });
  assert.throws(() => assertQuickMatrix(removed), /missing evidence cell tokens/);
  const duplicate = mutateQuickMatrix(quickstart, (cells) => { if (cells[0] === 'R1-003') cells[3] += ' E07'; return cells; });
  assert.throws(() => assertQuickMatrix(duplicate), /duplicate evidence token/);
  const wrong = mutateQuickMatrix(quickstart, (cells) => { if (cells[0] === 'R1-001') cells[3] = 'E05: synchronized wrong-row substitution'; return cells; });
  assert.throws(() => assertQuickMatrix(wrong), /quickstart matrix (?:canonical )?evidence(?: cell)? for R1-001/);
  const unknown = mutateQuickMatrix(quickstart, (cells) => { if (cells[0] === 'INV-07') cells[3] = 'E99: unknown'; return cells; });
  assert.throws(() => assertQuickMatrix(unknown), /unknown evidence E99/);
  const substringDecoy = mutateQuickMatrix(quickstart, (cells) => { if (cells[0] === 'R1-003') cells[3] = 'prefixE07suffix'; return cells; }) + '\nE07 global decoy\n';
  assert.throws(() => assertQuickMatrix(substringDecoy), /missing evidence cell tokens/);
  const proseDecoy = mutateQuickMatrix(quickstart, (cells) => { if (cells[0] === 'R1-003') cells[3] = 'No retained proof here; E07 is only a prose decoy and is not evidence'; return cells; });
  assert.throws(() => assertQuickMatrix(proseDecoy), /canonical evidence cell for R1-003/);
  const matrix = section(quickstart, QUICK_MATRIX_START, QUICK_OP_START), row = matrix.split(/\r?\n/).find((line) => /^\| R1-001 \|/.test(line));
  const duplicateRow = quickstart.replace(row, row + '\n' + row);
  assert.throws(() => assertQuickMatrix(duplicateRow), /duplicate quickstart matrix row/);
});

test('definition and task mapping snapshots reject synchronized substitutions and duplicate rows', () => {
  const changedTasks = tasks.replace('`ORB-R1-0202`, `ORB-R1-0209`', '`ORB-R1-0202`, `ORB-R1-9999`');
  assert.throws(() => assertTaskRequirementMapping(changedTasks), /task-cell mapping changed/);
  const changedEvidenceTasks = tasks.replace('| E03 | `ORB-R1-1309`', '| E03 | `ORB-R1-9999`');
  assert.throws(() => assertTaskEvidenceMapping(changedEvidenceTasks), /E01-E17 mapping changed/);
  const missingDefinition = quickstart.replace('## E02 — Contract and deferred-surface rejection', '## Contract and deferred-surface rejection');
  assert.throws(() => assertExactInventory(quickEvidenceDefinitions(missingDefinition), evidence, 'quickstart evidence definitions'), /quickstart evidence definitions/);
  const duplicatedDefinition = quickstart.replace('## E02 — Contract and deferred-surface rejection', '## E02 — Contract and deferred-surface rejection\n## E02 — duplicate');
  assert.throws(() => assertExactInventory(quickEvidenceDefinitions(duplicatedDefinition), evidence, 'quickstart evidence definitions'), /duplicate/);
});
