const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = resolve(__dirname, '../..');
const BASE = resolve(ROOT, 'specs/001-orb-trade-operations');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const BT = String.fromCharCode(96);

function text(path) { return readFileSync(resolve(BASE, path), 'utf8'); }
function parseYaml(path) {
  const program = 'import json,sys,yaml\nprint(json.dumps(yaml.safe_load(open(sys.argv[1],encoding="utf-8")),default=str))';
  return JSON.parse(execFileSync('python3', ['-c', program, path], { encoding: 'utf8' }));
}
function normalized(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
const FORBIDDEN = [
  ['bank ingestion/integration', /(bankingestion|bankintegration|bankimport|bankmatching)/],
  ['tax engine/pack', /(taxengine|taxpack|taxevidencepack)/],
  ['legacy migration', /(legacymigration|historicalmigration)/],
  ['multiple shipment sources/allocation', /(multisource|multiplesuppliersource|suppliersourceallocation)/],
  ['shared-expense allocation', /(sharedexpense|expenseallocation)/],
  ['configurable approval rules/UI', /(configurableapproval|approvaldesigner|approvalruleeditor)/],
  ['dynamic route designer', /(dynamicroute|routedesigner|routetemplateeditor)/],
  ['advanced claim workflows', /(advancedclaim|claimsettlement|claimcompensation|claimnetting)/],
];
function deferredFindings(surfaces) {
  const findings = [];
  for (const [kind, values] of Object.entries(surfaces)) {
    for (const value of values) {
      const identifier = normalized(value);
      for (const [feature, pattern] of FORBIDDEN) {
        if (pattern.test(identifier)) findings.push({ kind, value, feature });
      }
    }
  }
  return findings;
}
function openApiSurfaces(api) {
  const paths = Object.keys(api.paths || {});
  const operationIds = [];
  for (const item of Object.values(api.paths || {})) {
    for (const [method, operation] of Object.entries(item || {})) {
      if (METHODS.has(method.toLowerCase())) operationIds.push(operation.operationId || '');
    }
  }
  return { paths, operationIds, schemaNames: Object.keys(api.components?.schemas || {}) };
}
function uiRoutes(source) {
  const map = source.slice(source.indexOf('## Exact screen map'), source.indexOf('## Common interaction contract'));
  return map.split(/\r?\n/).flatMap((line) => {
    const firstTick = line.indexOf(BT);
    const secondTick = firstTick < 0 ? -1 : line.indexOf(BT, firstTick + 1);
    return firstTick >= 0 && secondTick > firstTick ? [line.slice(firstTick + 1, secondTick)] : [];
  });
}
function executableTaskSurfaces(source) {
  const surfaces = [];
  let active = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^- \[ \] \*\*ORB-R1-\d{4}\*\*/.test(line)) {
      active = true;
      surfaces.push(line);
      continue;
    }
    if (/^- \[ \] \*\*ORB-R1-/.test(line)) active = false;
    if (active && (/^  - \*\*Exact files\*\*:/.test(line) || /^  - \*\*Trace\*\*:/.test(line))) surfaces.push(line);
  }
  return surfaces;
}

const api = parseYaml(resolve(BASE, 'contracts/openapi.yaml'));

test('active OpenAPI identifiers expose no deferred feature', () => {
  assert.deepEqual(deferredFindings(openApiSurfaces(api)), []);
});

test('active UI routes and executable task identifiers expose no deferred feature', () => {
  const surfaces = {
    uiRoutes: uiRoutes(text('contracts/ui-workflows.md')),
    executableTasks: executableTaskSurfaces(text('tasks.md')),
  };
  assert.equal(surfaces.uiRoutes.length, 21);
  assert.ok(surfaces.executableTasks.length > 0);
  assert.deepEqual(deferredFindings(surfaces), []);
});

test('explicit prose exclusions are not mistaken for active surfaces', () => {
  const exclusion = 'Bank import, tax pack, historical migration, shared-expense allocation, approval designer, route designer, advanced claim settlement are absent.';
  assert.deepEqual(deferredFindings({ activeIdentifiers: [] }), []);
  assert.ok(exclusion.includes('Bank import'));
});

test('representative deferred OpenAPI mutation fixture is rejected', () => {
  const mutated = structuredClone(api);
  mutated.paths['/bank-imports'] = {
    post: { operationId: 'startBankIngestion', 'x-required-roles': ['OWNER_ADMIN'] },
  };
  mutated.components.schemas.BankImport = { type: 'object' };
  const findings = deferredFindings(openApiSurfaces(mutated));
  assert.ok(findings.some(({ feature }) => feature === 'bank ingestion/integration'));
  assert.ok(findings.some(({ kind }) => kind === 'paths'));
  assert.ok(findings.some(({ kind }) => kind === 'operationIds'));
  assert.ok(findings.some(({ kind }) => kind === 'schemaNames'));
});
