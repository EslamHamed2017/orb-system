import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  catch (error) { throw new Error('Deferred-surface tests require executable python3 with PyYAML 6.0.1: ' + error.message); }
  assert.match(versions.python, /^3\.12\./, 'python3 must be pinned to Python 3.12.x');
  assert.equal(versions.pyyaml, '6.0.1', 'PyYAML must be pinned to 6.0.1');
}
function parseYaml(path) {
  pythonPreflight();
  const code = 'import json,sys,yaml\nwith open(sys.argv[1],encoding="utf-8") as f:v=yaml.safe_load(f)\nprint(json.dumps(v,separators=(",",":"),default=str))';
  return JSON.parse(execFileSync('python3', ['-c', code, path], { encoding: 'utf8' }));
}
function normalized(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
const FORBIDDEN = [
  ['multiple/secondary shipment sources or source allocation', /((multi|multiple)(shipment|supplier)?sources?|secondarysuppliersource|sources?allocation|allocationsource)/],
  ['shared-expense allocation', /(sharedexpenses?|expenseallocation)/],
  ['configurable approval/rule UI', /(configurable(approval|rule)|approvalrules?|approvaldesigner|approvalruleeditor|rule(editor|designer|configurator))/],
  ['dynamic route designer', /(dynamicroutes?|routedesigner|routetemplateeditor)/],
  ['tax engine/pack', /(taxengine|taxpacks?|taxevidencepack)/],
  ['bank ingestion/integration', /(bankingestion|bankintegration|bankimports?|bankmatching)/],
  ['legacy migration', /(legacymigration|historicalmigration)/],
  ['advanced/complex claim workflow', /((advanced|complex)claim(workflow)?|claim(settlement|compensation|netting)workflow?)/],
];
function deferredFindings(surfaces) {
  const findings = [];
  for (const [kind, values] of Object.entries(surfaces)) for (const value of values) for (const [feature, pattern] of FORBIDDEN)
    if (pattern.test(normalized(value))) findings.push({ kind, value, feature });
  return findings;
}
function schemaIdentifiers(schema, prefix, out) {
  if (Array.isArray(schema)) { schema.forEach((item, i) => schemaIdentifiers(item, prefix + '[' + i + ']', out)); return; }
  if (!schema || typeof schema !== 'object') return;
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [name, child] of Object.entries(schema.properties)) { out.propertyNames.push(prefix + '.' + name); schemaIdentifiers(child, prefix + '.' + name, out); }
  }
  if (Array.isArray(schema.enum)) for (const value of schema.enum) out.enumValues.push(prefix + ':' + value);
  if (schema.discriminator) {
    if (schema.discriminator.propertyName) out.discriminators.push(prefix + ':' + schema.discriminator.propertyName);
    for (const [key, value] of Object.entries(schema.discriminator.mapping || {})) out.discriminators.push(prefix + ':' + key + ':' + value);
  }
  for (const [key, value] of Object.entries(schema)) {
    if (/^(action|actionId|actions|control|transition|command)$/i.test(key)) {
      out.actionIdentifiers.push(prefix + ':' + key);
      if (typeof value === 'string') out.actionIdentifiers.push(prefix + ':' + value);
      if (Array.isArray(value)) out.actionIdentifiers.push(...value.filter((v) => typeof v === 'string').map((v) => prefix + ':' + v));
    }
    if (key !== 'properties' && key !== 'enum' && key !== 'discriminator') schemaIdentifiers(value, prefix + '.' + key, out);
  }
}
function openApiSurfaces(api) {
  const out = { paths: Object.keys(api.paths || {}), operationIds: [], schemaNames: Object.keys(api.components?.schemas || {}), propertyNames: [], enumValues: [], discriminators: [], actionIdentifiers: [] };
  for (const [path, item] of Object.entries(api.paths || {})) for (const [method, operation] of Object.entries(item || {})) if (METHODS.has(method.toLowerCase())) {
    out.operationIds.push(operation.operationId || '');
    schemaIdentifiers(operation, 'operation:' + (operation.operationId || path), out);
  }
  for (const [name, schema] of Object.entries(api.components?.schemas || {})) schemaIdentifiers(schema, 'schema:' + name, out);
  return out;
}
function splitRow(line) {
  const cells = []; let cell = '', inCode = false;
  for (const char of line.slice(1, line.lastIndexOf('|'))) {
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode) { cells.push(cell.trim()); cell = ''; } else cell += char;
  }
  cells.push(cell.trim()); return cells;
}
function uiSurfaces(source) {
  const start = source.indexOf('## Exact screen map'), end = source.indexOf('## Common interaction contract');
  assert.ok(start >= 0 && end > start, 'missing active UI table');
  const table = source.slice(start, end), cells = table.split(/\r?\n/).filter((line) => /^\|.*\|\s*$/.test(line) && !/^\|\s*:?-+/.test(line)).flatMap(splitRow);
  return { uiTableCells: cells.slice(3), uiBacktickIdentifiers: cells.flatMap((cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1])) };
}
function executableTaskSurfaces(source) {
  const result = { taskHeaders: [], exactFilePaths: [], traceOperations: [], traceUi: [] };
  let active = false;
  for (const line of source.split(/\r?\n/)) {
    const header = line.match(/^\s*- \[ \] \*\*(ORB-R1-\d{4})\*\*(.*)$/);
    if (header) { active = true; result.taskHeaders.push(header[1] + header[2]); continue; }
    if (/^\s*- \[[ xX]\] \*\*ORB-R1-/.test(line)) { active = false; continue; }
    if (!active) continue;
    if (/^\s+- \*\*Exact files\*\*:/.test(line)) result.exactFilePaths.push(...[...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    if (/^\s+- \*\*Trace\*\*:/.test(line)) {
      const op = line.match(/; operations ([^;]+); UI ([^;]+);/);
      if (op) {
        result.traceOperations.push(...op[1].split(',').map((v) => v.trim()).filter((v) => v !== 'none'));
        result.traceUi.push(...op[2].split(',').map((v) => v.trim()).filter((v) => v !== 'none'));
      }
    }
  }
  return result;
}
const api = parseYaml(resolve(BASE, 'contracts/openapi.yaml'));
const ui = text('contracts/ui-workflows.md'), tasks = text('tasks.md');

test('active structured OpenAPI identifiers expose no deferred feature', () => {
  const surfaces = openApiSurfaces(api); assert.equal(surfaces.operationIds.length, 79); assert.ok(surfaces.propertyNames.length > 0);
  assert.deepEqual(deferredFindings(surfaces), []);
});
test('active UI route/action/control cells and executable task identifiers expose no deferred feature', () => {
  const surfaces = { ...uiSurfaces(ui), ...executableTaskSurfaces(tasks) };
  assert.equal(surfaces.uiBacktickIdentifiers.filter((v) => v.startsWith('/')).length, 21);
  assert.ok(surfaces.taskHeaders.length > 0 && surfaces.exactFilePaths.length > 0 && surfaces.traceOperations.length > 0 && surfaces.traceUi.length > 0);
  assert.deepEqual(deferredFindings(surfaces), []);
});
test('prose exclusions are excluded from active structured surfaces', () => {
  const exclusion = 'Bank import, tax pack, legacy migration, shared-expense allocation, configurable rule UI, route designer, complex claim workflow are absent.';
  assert.deepEqual(deferredFindings({ activeIdentifiers: [] }), []); assert.ok(deferredFindings({ prose: [exclusion] }).length > 0);
});
test('representative OpenAPI path, operation, schema property and action mutations are rejected', () => {
  const mutated = structuredClone(api);
  mutated.paths['/multiple-shipment-sources'] = { post: { operationId: 'addSecondarySupplierSource', 'x-required-roles': ['OWNER_ADMIN'] } };
  mutated.components.schemas.DeferredSourceFixture = { type: 'object', properties: { multipleShipmentSources: { type: 'array', items: { type: 'string' } } } };
  const findings = deferredFindings(openApiSurfaces(mutated));
  for (const kind of ['paths', 'operationIds', 'propertyNames']) assert.ok(findings.some((finding) => finding.kind === kind), 'missing finding for ' + kind);
});
test('representative UI control and executable task file/action mutations are rejected', () => {
  const uiMutation = ui.replace('| `/projects` | Project list |', '| `/projects` | Project list | `configurableApprovalRuleEditor`;');
  assert.ok(deferredFindings(uiSurfaces(uiMutation)).some((finding) => finding.kind === 'uiBacktickIdentifiers'));
  const fileMutation = tasks.replace('`tests/contract/openapi-contract.test.ts`', '`src/bank-integration/ingest.ts`');
  assert.ok(deferredFindings(executableTaskSurfaces(fileMutation)).some((finding) => finding.kind === 'exactFilePaths'));
  const actionMutation = tasks.replace('; operations listMasterRecords,', '; operations addSecondarySupplierSource, listMasterRecords,');
  assert.ok(deferredFindings(executableTaskSurfaces(actionMutation)).some((finding) => finding.kind === 'traceOperations'));
});
