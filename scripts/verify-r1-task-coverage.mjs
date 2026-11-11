#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDINARY_ID = /^ORB-R1-\d{4}$/;
const CORRECTION_ID = /^ORB-R1-CORR-\d{4}$/;
const TASK_HEADER = /^- \[([ xX])\] \*\*(ORB-R1-(?:\d{4}|CORR-\d{4}))\*\*(.*)$/gm;
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
function fail(message) { throw new Error(message); }
function exact(values, expected, label) {
  const counts = new Map(); for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const missing = expected.filter((value) => !counts.has(value));
  const unknown = [...counts.keys()].filter((value) => !expected.includes(value));
  const duplicate = [...counts].filter(([, n]) => n !== 1).map(([value]) => value);
  if (missing.length || unknown.length || duplicate.length) fail(`${label} inventory mismatch: ${JSON.stringify({ missing, unknown, duplicate })}`);
}
function literalPath(path, context) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.endsWith('/') || path.includes('\\') || /[*?{}]/.test(path) || path.split('/').includes('..') || /(^|\/)\.(?:\/|$)/.test(path))
    fail(`${context}: expected literal file path, got ${JSON.stringify(path)}`);
}
function backticks(text) { return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]); }
function tableRows(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) fail(`missing canonical table section ${start}`);
  return source.slice(from, to).split(/\r?\n/).filter((line) => /^\|.*\|\s*$/.test(line) && !/^\|\s*:?-+/.test(line));
}
function cells(line) {
  const result = []; let value = '', code = false;
  for (const char of line.slice(1, line.lastIndexOf('|'))) {
    if (char === '`') code = !code;
    if (char === '|' && !code) { result.push(value.trim()); value = ''; } else value += char;
  }
  result.push(value.trim()); return result;
}
function parseTasks(source) {
  if (/^- \[[ xX]\] \*\*ORB-R1-CORR-(?!\d{4}\*\*)/m.test(source)) fail('non-concrete correction placeholder treated as executable task');
  const starts = [...source.matchAll(TASK_HEADER)];
  const tasks = starts.map((match, index) => {
    const body = source.slice(match.index, starts[index + 1]?.index ?? source.length);
    const field = (name) => body.match(new RegExp(`^  - \\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*:\\s*(.*)$`, 'm'))?.[1];
    for (const name of ['Prerequisites', 'Exact files', 'Output', 'Tests / acceptance evidence', 'Trace']) if (field(name) === undefined && ORDINARY_ID.test(match[2])) fail(`${match[2]} missing ${name}`);
    const prerequisites = backticks(field('Prerequisites') || '').filter((id) => ORDINARY_ID.test(id) || CORRECTION_ID.test(id));
    const exactFiles = backticks(field('Exact files') || '');
    return { id: match[2], checked: match[1].toLowerCase() === 'x', header: match[3], body, field, prerequisites, exactFiles };
  });
  exact(tasks.map((task) => task.id), [...new Set(tasks.map((task) => task.id))], 'task IDs');
  for (const task of tasks) if (task.checked) fail(`${task.id} is marked complete`);
  return tasks;
}
function verifyGraph(tasks) {
  const byId = new Map(tasks.map((task, index) => [task.id, { task, index }]));
  let edges = 0;
  for (const [index, task] of tasks.entries()) {
    exact(task.prerequisites, [...new Set(task.prerequisites)], `${task.id} prerequisites`);
    for (const prerequisite of task.prerequisites) {
      edges++;
      const known = byId.get(prerequisite);
      if (!known) fail(`${task.id}: unknown prerequisite ${prerequisite}`);
      if (known.index >= index) fail(`${task.id}: forward prerequisite ${prerequisite}`);
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) fail(`task dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id); for (const dependency of byId.get(id).task.prerequisites) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return edges;
}
function primaryMap(tasks) {
  const primary = new Map();
  for (const task of tasks) {
    if (CORRECTION_ID.test(task.id)) continue;
    for (const path of task.exactFiles) {
    literalPath(path, `${task.id} Exact files`);
    if (primary.has(path)) fail(`duplicate primary exact-file owner for ${path}: ${primary.get(path)} and ${task.id}`);
      primary.set(path, task.id);
    }
  }
  return primary;
}
function parseOperationIds(openapi) {
  const ids = [...openapi.matchAll(/^\s+operationId:\s*([A-Za-z][A-Za-z0-9]*)\s*$/gm)].map((match) => match[1]);
  exact(ids, [...new Set(ids)], 'OpenAPI operationId'); return ids;
}
function requireTask(byId, id) { const task = byId.get(id); if (!task) fail(`missing task ${id}`); return task; }
function assertKnownMappedTasks(rows, byId, label) {
  for (const row of rows) {
    const ids = backticks(row).filter((value) => ORDINARY_ID.test(value) || CORRECTION_ID.test(value));
    exact(ids, [...new Set(ids)], `${label} mapped tasks`);
    for (const id of ids) if (!byId.has(id)) fail(`${label}: unknown mapped task ${id}`);
  }
}
function assertPrerequisites(byId) {
  const has = (id, dependency) => {
    const seen = new Set(), pending = [...requireTask(byId, id).prerequisites];
    while (pending.length) { const current = pending.pop(); if (current === dependency) return true; if (seen.has(current)) continue; seen.add(current); pending.push(...requireTask(byId, current).prerequisites); }
    return false;
  };
  const todaySources = ['ORB-R1-0304','ORB-R1-0402','ORB-R1-0502','ORB-R1-0602','ORB-R1-0604','ORB-R1-0704','ORB-R1-0802','ORB-R1-0902','ORB-R1-1002','ORB-R1-1102','ORB-R1-1202'];
  for (const dependency of todaySources) if (!has('ORB-R1-1211', dependency)) fail(`ORB-R1-1211 incomplete Today source prerequisites: ${dependency}`);
  for (const [acceptance, deployment] of [['ORB-R1-1309','ORB-R1-1308'],['ORB-R1-1310','ORB-R1-1308'],['ORB-R1-1315','ORB-R1-1314']])
    if (!has(acceptance, deployment)) fail(`${acceptance}: acceptance-before-deployment (${deployment} missing)`);
  for (const id of ['ORB-R1-1309','ORB-R1-1310','ORB-R1-1315']) {
    const body = requireTask(byId, id).body.toLowerCase();
    if (!(body.includes('frozen') || body.includes('same orb-r1-1307')) || !body.includes('digest') || !body.includes('environment')) fail(`${id}: evidence lacks frozen digest/environment identity`);
  }
}
function parseCorrectionTasks(tasks, initialPrimary) {
  const corrections = tasks.filter((task) => CORRECTION_ID.test(task.id)).map((task) => {
    const list = (name) => backticks(task.field(name) || '');
    const mapping = (name) => {
      const entries = list(name).map((entry) => {
        const match = entry.match(/^(.+?)\s*->\s*(ORB-R1-(?:\d{4}|CORR-\d{4})|none)$/);
        if (!match) fail(`${task.id}: invalid ${name} mapping ${entry}`);
        return [match[1], match[2]];
      });
      const paths = entries.map(([path]) => path);
      exact(paths, [...new Set(paths)], `${task.id} duplicate ${name} mapping`);
      return Object.fromEntries(entries);
    };
    return {
      id: task.id, prerequisites: task.prerequisites, exactFiles: task.exactFiles,
      correctsFiles: list('Corrects files'), primaryOwner: mapping('Primary owner'), supersedes: mapping('Supersedes'),
      defect: task.field('Defect / reason'), retainedFailingTest: /fail-before-edit|retained failing/i.test(task.field('Failing test evidence') || ''),
      failingTestPaths: list('Failing test evidence'), regressionScope: task.field('Focused regression'), impactScope: task.field('Impact scope'),
      reviews: { security: task.field('Security review'), integrity: task.field('Integrity review'), contract: task.field('Contract review') },
      approval: task.field('Reviewer approval') ? { reviewer: task.field('Reviewer approval'), at: task.field('Reviewer approval'), beforeEdit: /before edit|pre-edit/i.test(task.field('Reviewer approval')) } : undefined,
      changedPaths: list('Changed paths'),
    };
  });
  if (!corrections.length) return { primaryFiles: initialPrimary.size, correctionOverlays: 0 };
  return verifyCorrectionModel({ primary: Object.fromEntries(initialPrimary), corrections });
}

export function parseGitNameStatus(output) {
  if (typeof output !== 'string') fail('Git name-status output must be text');
  if (!output) return [];
  const tokens = output.split('\0');
  if (tokens.pop() !== '') fail('malformed Git name-status output: missing NUL terminator');
  const paths = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!/^[ACDMRTUXB](?:\d{1,3})?$/.test(status)) fail(`unsupported Git change status ${status}`);
    const count = /^[CR]/.test(status) ? 2 : 1;
    if (index + count > tokens.length) fail(`malformed Git name-status entry for ${status}`);
    for (let offset = 0; offset < count; offset++) {
      const path = tokens[index++];
      if (!path) fail(`malformed Git name-status entry for ${status}`);
      paths.push(path);
    }
  }
  return [...new Set(paths)];
}

export function verifyTaskChangeAuthorization(taskSource, taskId, changedPaths) {
  if (typeof taskSource !== 'string') fail('missing task source');
  const tasks = parseTasks(taskSource), byId = new Map(tasks.map((task) => [task.id, task]));
  const task = byId.get(taskId);
  if (!task) fail(`unknown selected task ${taskId}`);
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) fail(`${taskId}: no actual changed paths`);
  for (const path of changedPaths) literalPath(path, `${taskId} actual changed path`);
  exact(changedPaths, [...new Set(changedPaths)], `${taskId} duplicate actual changed paths`);

  const primary = primaryMap(tasks);
  // Validate the complete overlay model before trusting correction authorizations.
  parseCorrectionTasks(tasks, primary);
  const authorized = new Set(task.exactFiles);
  if (CORRECTION_ID.test(task.id)) for (const path of backticks(task.field('Corrects files') || '')) authorized.add(path);
  for (const path of changedPaths) {
    if (authorized.has(path)) continue;
    const owner = primary.get(path);
    fail(`${taskId}: unauthorized changed path ${path} (${owner ? `primary owner ${owner}` : 'unowned'})`);
  }
  return { taskId, changedPaths: changedPaths.length };
}

export function verifyCorrectionModel(model) {
  if (!model || typeof model !== 'object' || !model.primary || !Array.isArray(model.corrections)) fail('invalid correction model');
  const primary = new Map(Object.entries(model.primary));
  for (const [path, owner] of primary) { literalPath(path, 'primary map'); if (!ORDINARY_ID.test(owner) && !CORRECTION_ID.test(owner)) fail(`invalid primary owner ${owner}`); }
  const ids = model.corrections.map((item) => item.id); exact(ids, [...new Set(ids)], 'correction IDs');
  const priorByTarget = new Map(); let overlays = 0;
  for (const correction of model.corrections) {
    if (!CORRECTION_ID.test(correction.id)) fail(`non-concrete correction ID ${correction.id}`);
    if (!correction.defect) fail(`${correction.id}: missing defect/reason`);
    if (!correction.retainedFailingTest) fail(`${correction.id}: missing retained failing test result`);
    if (!Array.isArray(correction.failingTestPaths) || !correction.failingTestPaths.length) fail(`${correction.id}: missing exact failing-test path`);
    for (const path of correction.failingTestPaths) literalPath(path, `${correction.id} failing-test path`);
    if (!correction.regressionScope || !correction.impactScope) fail(`${correction.id}: missing regression/impact scope`);
    for (const kind of ['security','integrity','contract']) if (!correction.reviews?.[kind]) fail(`${correction.id}: missing ${kind} review disposition`);
    if (!correction.approval?.reviewer || !correction.approval?.at || correction.approval.beforeEdit !== true) fail(`${correction.id}: missing explicit pre-edit reviewer approval`);
    if (!correction.prerequisites?.includes('ORB-R1-1316')) fail(`${correction.id}: missing branch-selection prerequisite`);
    const targets = correction.correctsFiles || [], ownerKeys = Object.keys(correction.primaryOwner || {}), supersedesKeys = Object.keys(correction.supersedes || {});
    for (const path of targets) literalPath(path, `${correction.id} Corrects files`);
    exact(ownerKeys, targets, `${correction.id} primary owner mapping`); exact(supersedesKeys, targets, `${correction.id} supersedes mapping`);
    for (const path of correction.exactFiles || []) {
      literalPath(path, `${correction.id} Exact files`);
      if (primary.has(path)) fail(`${correction.id}: duplicate primary owner for new file ${path}`);
      primary.set(path, correction.id);
    }
    for (const path of targets) {
      literalPath(path, `${correction.id} Corrects files`);
      if (!primary.has(path)) fail(`${correction.id}: unknown overlay target ${path}`);
      if (correction.primaryOwner[path] !== primary.get(path)) fail(`${correction.id}: wrong primary owner for ${path}`);
      if (!correction.prerequisites.includes(primary.get(path))) fail(`${correction.id}: missing primary owner prerequisite ${primary.get(path)}`);
      const prior = priorByTarget.get(path) || 'none';
      if (correction.supersedes[path] !== prior) fail(`${correction.id}: ${path} supersedes ${correction.supersedes[path]}, expected ${prior}`);
      if (prior !== 'none' && !correction.prerequisites.includes(prior)) fail(`${correction.id}: missing prior overlay prerequisite ${prior}`);
      priorByTarget.set(path, correction.id); overlays++;
    }
    const authorized = new Set([...(correction.exactFiles || []), ...targets]);
    for (const path of correction.changedPaths || []) if (!authorized.has(path)) fail(`${correction.id}: undeclared edit ${path}`);
    for (const path of authorized) if (!(correction.changedPaths || []).includes(path)) fail(`${correction.id}: declared authorization absent from changed paths ${path}`);
  }
  return { primaryFiles: primary.size, correctionOverlays: overlays };
}

export function verifyRepositorySources({ tasks: taskSource, openapi, ui, spec, quickstart }) {
  for (const [name, value] of Object.entries({ tasks: taskSource, openapi, ui, spec, quickstart })) if (typeof value !== 'string') fail(`missing source ${name}`);
  const tasks = parseTasks(taskSource), ordinary = tasks.filter((task) => ORDINARY_ID.test(task.id));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const edges = verifyGraph(tasks), primary = primaryMap(tasks);
  const operations = parseOperationIds(openapi);
  const expectedRequirements = Array.from({ length: 20 }, (_, i) => `R1-${String(i + 1).padStart(3, '0')}`);
  const expectedInvariants = Array.from({ length: 7 }, (_, i) => `INV-${String(i + 1).padStart(2, '0')}`);
  const requirementAuthority = spec + '\n' + quickstart;
  for (const id of [...expectedRequirements, ...expectedInvariants]) if (!new RegExp(`(^|[^A-Za-z0-9_-])${id}([^A-Za-z0-9_-]|$)`, 'm').test(requirementAuthority)) fail(`authoritative artifacts missing ${id}`);
  const operationTableRows = tableRows(taskSource, '### OperationId to implementation/verification tasks (107/107)', '### Requirement/invariant mapping (20/20 + 7/7)');
  assertKnownMappedTasks(operationTableRows, byId, 'operation mapping');
  const operationRows = operationTableRows.map((row) => backticks(cells(row)[0])[0]).filter(Boolean);
  exact(operationRows, operations, 'operation mapping');
  const requirementTableRows = tableRows(taskSource, '### Requirement/invariant mapping (20/20 + 7/7)', '### UI route mapping and actual page ownership (21/21)');
  assertKnownMappedTasks(requirementTableRows, byId, 'requirement/invariant mapping');
  const requirementRows = requirementTableRows.map((row) => cells(row)[0]).filter((id) => /^(?:R1-\d{3}|INV-\d{2})$/.test(id));
  exact(requirementRows, [...expectedRequirements, ...expectedInvariants], 'requirement/invariant mapping');
  const uiTableRows = tableRows(taskSource, '### UI route mapping and actual page ownership (21/21)', '### Numbered evidence mapping (17/17; deployed runtime only)');
  const uiRows = uiTableRows.map(cells).filter((row) => backticks(row[1] || '')[0]?.startsWith('/'));
  const routes = uiRows.map((row) => backticks(row[1])[0]);
  const contractRoutes = tableRows(ui, '## Exact screen map', '## Common interaction contract').map((row) => backticks(cells(row)[0])[0]).filter((route) => route?.startsWith('/'));
  exact(routes, contractRoutes, 'UI route mapping');
  const pageFiles = uiRows.flatMap((row) => backticks(row[2])).filter((path) => path.startsWith('src/app/') && path.endsWith('/page.tsx'));
  exact(pageFiles, [...new Set(pageFiles)], 'actual page files');
  for (const row of uiRows) {
    const declaredOwner = backticks(row[3] || '')[0];
    for (const path of backticks(row[2]).filter((value) => value.startsWith('src/app/') && value.endsWith('/page.tsx'))) {
      if (!primary.has(path)) fail(`actual page file lacks primary owner: ${path}`);
      if (primary.get(path) !== declaredOwner) fail(`actual page file owner mismatch for ${path}: declared ${declaredOwner}, primary ${primary.get(path)}`);
    }
  }
  assertKnownMappedTasks(uiTableRows, byId, 'UI route mapping');
  const expectedEvidence = Array.from({ length: 17 }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);
  const evidenceTableRows = tableRows(taskSource, '### Numbered evidence mapping (17/17; deployed runtime only)', '## Dependency and parallel execution rules');
  assertKnownMappedTasks(evidenceTableRows, byId, 'evidence mapping');
  const evidenceRows = evidenceTableRows.map((row) => cells(row)[0]).filter((id) => /^E\d{2}$/.test(id));
  exact(evidenceRows, expectedEvidence, 'evidence mapping');
  const quickEvidence = [...quickstart.matchAll(/^## (E\d{2})\b/gm), ...quickstart.matchAll(/^\*\*(E\d{2})\.\*\*/gm)].map((match) => match[1]);
  exact(quickEvidence, expectedEvidence, 'quickstart evidence');
  assertPrerequisites(byId);
  const correction = parseCorrectionTasks(tasks, primary);
  return { tasks: ordinary.length, edges, primaryFiles: correction.primaryFiles, correctionOverlays: correction.correctionOverlays, operations: operations.length, requirements: expectedRequirements.length, invariants: expectedInvariants.length, uiRoutes: routes.length, pageFiles: pageFiles.length, evidence: evidenceRows.length };
}

export function changedPathsFromGit(root, arguments_, execute = execFileSync) {
  let taskId, mode, reference, graphOnly = false;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === '--graph-only') {
      if (graphOnly) fail('duplicate --graph-only');
      graphOnly = true;
    } else if (argument === '--task') {
      if (taskId) fail('duplicate --task');
      taskId = arguments_[++index];
      if (!taskId) fail('--task requires an ID');
    } else if (argument === '--staged') mode = mode ? fail('choose exactly one changed-path source') : 'staged';
    else if (argument === '--changed-from') {
      mode = mode ? fail('choose exactly one changed-path source') : 'reference';
      reference = arguments_[++index];
      if (!reference) fail('--changed-from requires a Git reference');
    } else fail(`unknown argument ${argument}`);
  }
  if (graphOnly) {
    if (taskId || mode) fail('--graph-only cannot be combined with task change authorization');
    return null;
  }
  if (!taskId || !mode) fail('CLI requires --graph-only or --task with exactly one of --staged or --changed-from');
  const common = ['diff', '--name-status', '-z', '--find-renames', '--find-copies-harder', '--diff-filter=ACDMRTUXB'];
  const gitArguments = mode === 'staged'
    ? [...common, '--cached', '--']
    : [...common, `${reference}...HEAD`, '--'];
  const output = execute('git', gitArguments, { cwd: root, encoding: 'utf8' });
  return { taskId, paths: parseGitNameStatus(output) };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), base = resolve(root, 'specs/001-orb-trade-operations');
  const read = (path) => readFileSync(resolve(base, path), 'utf8');
  const taskSource = read('tasks.md');
  const result = verifyRepositorySources({ tasks: taskSource, openapi: read('contracts/openapi.yaml'), ui: read('contracts/ui-workflows.md'), spec: read('spec.md'), quickstart: read('quickstart.md') });
  const changeRequest = changedPathsFromGit(root, process.argv.slice(2));
  const changes = changeRequest ? verifyTaskChangeAuthorization(taskSource, changeRequest.taskId, changeRequest.paths) : undefined;
  process.stdout.write(`ORB R1 task coverage PASS ${JSON.stringify(changes ? { ...result, changes } : result)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`ORB R1 task coverage FAIL: ${error.message}\n`); process.exitCode = 1; }
}
