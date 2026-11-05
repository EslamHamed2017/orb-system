import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseYaml } from './openapi-contract.test.ts';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = resolve(ROOT, 'specs/001-orb-trade-operations');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
function text(path) { return readFileSync(resolve(BASE, path), 'utf8'); }
function normalized(value) { return String(value).replace(/~[01]/g, '/').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
const FORBIDDEN = [
  ['multiple/secondary shipment sources or source allocation', /(?:multi(?:ple)?(?:shipment|supplier)?sources?|secondary(?:shipment|supplier)?source|secondarysource|sources?allocation|allocationsource)/],
  ['shared-expense allocation', /(sharedexpenses?|expenseallocation)/],
  ['configurable approval/rule UI', /(configurable(approval|rule)|approvalrules?|approvaldesigner|approvalruleeditor|rule(editor|designer|configurator))/],
  ['dynamic route designer', /(dynamicroutes?|routedesigner|routetemplateeditor)/],
  ['tax engine/pack', /(taxengine|taxpacks?|taxevidencepack)/],
  ['bank ingestion/integration', /(bankingestion|bankintegration|bankimports?|bankmatching)/],
  ['legacy migration', /(legacymigration|historicalmigration)/],
  ['advanced/complex claim workflow', /(?:(?:advanced|complex)claim(?:workflow)?|claim(?:settlement|compensation|netting)(?:workflow)?)/],
];
function deferredFindings(surfaces) {
  const findings = [];
  for (const [kind, values] of Object.entries(surfaces)) for (const value of values) for (const [feature, pattern] of FORBIDDEN)
    if (pattern.test(normalized(value))) findings.push({ kind, value, feature });
  return findings;
}
function decodeReferenceTokens(reference) {
  assert.match(reference, /^#\//, 'Only local JSON Pointer refs are accepted: ' + reference);
  return reference.slice(2).split('/').map((raw) => {
    assert.doesNotMatch(raw, /~(?:[^01]|$)/, 'Invalid JSON Pointer escape in local ref: ' + reference);
    return raw.replace(/~1/g, '/').replace(/~0/g, '~');
  });
}
const PROSE_ONLY = new Set(['description', 'summary', 'title', 'example', 'examples', 'externalDocs']);
const IDENTIFIER_VALUES = new Set(['name', 'operationId', 'required', 'enum', 'const', 'propertyName', 'tags', 'type', 'format', 'in']);
function addStrings(value, prefix, target) {
  if (typeof value === 'string') target.push(prefix + ':' + value);
  else if (Array.isArray(value)) value.forEach((item, index) => addStrings(item, prefix + '[' + index + ']', target));
}
function schemaIdentifiers(schema, prefix, out, parentKey = '') {
  if (Array.isArray(schema)) { schema.forEach((item, i) => schemaIdentifiers(item, prefix + '[' + i + ']', out, parentKey)); return; }
  if (!schema || typeof schema !== 'object') return;
  for (const [name, value] of Object.entries(schema)) {
    const qualified = prefix + '.' + name;
    out.schemaKeys.push(qualified);
    if (parentKey === 'properties') out.propertyNames.push(qualified);
    if (PROSE_ONLY.has(name)) continue;
    if (name === '$ref') {
      assert.equal(typeof value, 'string', qualified + ' must be a string');
      for (const token of decodeReferenceTokens(value)) out.schemaReferences.push(qualified + ':' + token);
      continue;
    }
    // Every non-prose string is structural data; named buckets retain useful diagnostics.
    addStrings(value, qualified, out.structuralValues);
    if (IDENTIFIER_VALUES.has(name)) addStrings(value, qualified, name === 'enum' || name === 'const' ? out.enumValues : out.structuralValues);
    if (name === 'dependentRequired' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [dependent, dependencies] of Object.entries(value)) {
        out.structuralValues.push(qualified + ':' + dependent);
        addStrings(dependencies, qualified + '.' + dependent, out.structuralValues);
      }
    }
    if (parentKey === 'mapping') {
      out.discriminators.push(qualified);
      if (typeof value === 'string') for (const token of decodeReferenceTokens(value)) out.discriminators.push(qualified + ':' + token);
    }
    if (name === 'propertyName' && typeof value === 'string') out.discriminators.push(qualified + ':' + value);
    if (parentKey === 'security') out.securityNames.push(qualified);
    if (/^(action|actionId|actions|control|transition|command)$/i.test(name)) {
      out.actionIdentifiers.push(qualified);
      addStrings(value, qualified, out.actionIdentifiers);
    }
    schemaIdentifiers(value, qualified, out, name);
  }
}
function openApiSurfaces(api) {
  const out = { paths: Object.keys(api.paths || {}), operationIds: [], schemaNames: Object.keys(api.components?.schemas || {}), schemaKeys: [], schemaReferences: [], propertyNames: [], enumValues: [], discriminators: [], actionIdentifiers: [], structuralValues: [], securityNames: [] };
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
  const data = cells.slice(3), rows = []; for (let i = 0; i < data.length; i += 3) rows.push(data.slice(i, i + 3));
  return { uiRoutes: rows.flatMap((row) => [...((row[0] || '').matchAll(/`([^`]+)`/g))].map((m) => m[1])), uiControlIdentifiers: rows.flatMap((row) => (row[2] || '').split(';').map((value) => value.trim()).filter(Boolean).concat([...((row[2] || '').matchAll(/`([^`]+)`/g))].map((m) => m[1]))) };
}
function executableTaskSurfaces(source) {
  const result = { taskHeaders: [], exactFilePaths: [], traceRequirements: [], traceOperations: [], traceUi: [], traceEvidence: [] };
  let active = false;
  for (const line of source.split(/\r?\n/)) {
    const header = line.match(/^\s*- \[ \] \*\*(ORB-R1-\d{4})\*\*(.*)$/);
    if (header) { active = true; result.taskHeaders.push(header[1] + header[2]); continue; }
    if (/^\s*- \[[ xX]\] \*\*ORB-R1-/.test(line)) { active = false; continue; }
    if (!active) continue;
    if (/^\s+- \*\*Exact files\*\*:/.test(line)) result.exactFilePaths.push(...[...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]));
    if (/^\s+- \*\*Trace\*\*:/.test(line)) {
      const trace = line.match(/requirements ([^;]+); operations ([^;]+); UI ([^;]+); evidence ([^.]+)\.?$/);
      assert.ok(trace, 'malformed active task Trace field: ' + line);
      const values = (part) => part.split(',').map((value) => value.trim()).filter((value) => value && value !== 'none');
      result.traceRequirements.push(...values(trace[1]));
      result.traceOperations.push(...values(trace[2]));
      result.traceUi.push(...values(trace[3]));
      result.traceEvidence.push(...values(trace[4]));
    }
  }
  return result;
}
const api = parseYaml(text('contracts/openapi.yaml'));
const ui = text('contracts/ui-workflows.md'), tasks = text('tasks.md');

test('active structured OpenAPI identifiers expose no deferred feature', () => {
  const surfaces = openApiSurfaces(api); assert.equal(surfaces.operationIds.length, 79); assert.ok(surfaces.propertyNames.length > 0 && surfaces.schemaKeys.length > surfaces.propertyNames.length);
  assert.deepEqual(deferredFindings(surfaces), []);
});
test('active UI route/action/control cells and executable task identifiers expose no deferred feature', () => {
  const surfaces = { ...uiSurfaces(ui), ...executableTaskSurfaces(tasks) };
  assert.equal(surfaces.uiRoutes.filter((v) => v.startsWith('/')).length, 21);
  assert.ok(surfaces.taskHeaders.length > 0 && surfaces.exactFilePaths.length > 0 && surfaces.traceRequirements.length > 0 && surfaces.traceOperations.length > 0 && surfaces.traceUi.length > 0 && surfaces.traceEvidence.length > 0);
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
  const nestedName = structuredClone(api);
  nestedName.components.schemas[Object.keys(nestedName.components.schemas)[0]].$defs = { SecondarySource: { type: 'object' } };
  assert.ok(deferredFindings(openApiSurfaces(nestedName)).some((finding) => finding.kind === 'schemaKeys' && finding.value.endsWith('.SecondarySource')));
  const discriminatorKey = structuredClone(api);
  discriminatorKey.components.schemas.DeferredDiscriminatorProbe = { discriminator: { propertyName: 'kind', mapping: { secondarySource: '#/components/schemas/Error' } } };
  assert.ok(deferredFindings(openApiSurfaces(discriminatorKey)).some((finding) => finding.kind === 'schemaKeys' && finding.value.endsWith('.secondarySource')));
});
test('identifier-bearing OpenAPI values are scanned while prose-only values are excluded', () => {
  const probes = [
    ['required', { type: 'object', required: ['secondarySource'], properties: { safe: { type: 'string' } } }],
    ['dependentRequired-key', { type: 'object', dependentRequired: { secondarySource: ['safe'] } }],
    ['dependentRequired-value', { type: 'object', dependentRequired: { safe: ['secondarySource'] } }],
    ['propertyNames', { type: 'object', propertyNames: { const: 'secondarySource' } }],
    ['enum', { type: 'string', enum: ['secondarySource'] }],
    ['const', { type: 'string', const: 'secondarySource' }],
    ['discriminator-propertyName', { discriminator: { propertyName: 'secondarySource' } }],
    ['discriminator-mapping', { discriminator: { propertyName: 'kind', mapping: { safe: '#/components/schemas/SecondarySource' } } }],
  ];
  for (const [label, schema] of probes) {
    const mutated = structuredClone(api); mutated.components.schemas.IdentifierValueProbe = schema;
    assert.ok(deferredFindings(openApiSurfaces(mutated)).length, label + ' escaped structured-value detection');
  }
  const operationValues = structuredClone(api);
  const firstOperation = Object.values(operationValues.paths)[0];
  const firstMethod = Object.keys(firstOperation).find((method) => METHODS.has(method.toLowerCase()));
  firstOperation[firstMethod].tags = ['secondarySource'];
  firstOperation[firstMethod].security = [{ secondarySource: [] }];
  const operationFindings = deferredFindings(openApiSurfaces(operationValues));
  assert.ok(operationFindings.some((finding) => finding.kind === 'structuralValues'));
  assert.ok(operationFindings.some((finding) => finding.kind === 'securityNames'));

  const prose = structuredClone(api);
  prose.components.schemas.ProseProbe = {
    type: 'object', description: 'secondarySource', summary: 'secondarySource', title: 'secondarySource',
    example: { secondarySource: true }, examples: [{ secondarySource: true }], externalDocs: { description: 'secondarySource', url: 'https://example.test/secondarySource' },
  };
  assert.deepEqual(deferredFindings(openApiSurfaces(prose)), []);
});
test('JSON Pointer refs decode slash and tilde tokens, reject malformed escapes, and cannot hide deferred identifiers', () => {
  const escaped = structuredClone(api);
  escaped.components.schemas['Slash/Name'] = { type: 'string' };
  escaped.components.schemas['Tilde~Name'] = { type: 'string' };
  escaped.components.schemas.RefProbe = { allOf: [{ $ref: '#/components/schemas/Slash~1Name' }, { $ref: '#/components/schemas/Tilde~0Name' }] };
  assert.deepEqual(deferredFindings(openApiSurfaces(escaped)), []);

  const hidden = structuredClone(api);
  hidden.components.schemas['Secondary~1Source'] = { type: 'string' };
  hidden.components.schemas.RefProbe = { $ref: '#/components/schemas/Secondary~01Source' };
  const findings = deferredFindings(openApiSurfaces(hidden));
  assert.ok(findings.some((finding) => finding.kind === 'schemaNames' && finding.value === 'Secondary~1Source'));
  assert.ok(findings.some((finding) => finding.kind === 'schemaReferences' && finding.value.endsWith(':Secondary~1Source')));

  for (const reference of ['#/components/schemas/Bad~2Name', '#/components/schemas/Bad~']) {
    const malformed = structuredClone(api); malformed.components.schemas.RefProbe = { $ref: reference };
    assert.throws(() => openApiSurfaces(malformed), /Invalid JSON Pointer escape/);
  }
});

test('representative UI control and executable task file/action mutations are rejected', () => {
  const uiMutation = ui.replace('| `/projects` | Project list |', '| `/projects` | Project list | `configurableApprovalRuleEditor`;');
  assert.ok(deferredFindings(uiSurfaces(uiMutation)).some((finding) => finding.kind === 'uiControlIdentifiers'));
  const fileMutation = tasks.replace('`tests/contract/openapi-contract.test.ts`', '`src/bank-integration/ingest.ts`');
  assert.ok(deferredFindings(executableTaskSurfaces(fileMutation)).some((finding) => finding.kind === 'exactFilePaths'));
  const actionMutation = tasks.replace('; operations listMasterRecords,', '; operations addSecondarySupplierSource, listMasterRecords,');
  assert.ok(deferredFindings(executableTaskSurfaces(actionMutation)).some((finding) => finding.kind === 'traceOperations'));
  const requirementMutation = tasks.replace('**Trace**: requirements R1-001,', '**Trace**: requirements secondarySource, R1-001,');
  assert.ok(deferredFindings(executableTaskSurfaces(requirementMutation)).some((finding) => finding.kind === 'traceRequirements' && finding.value === 'secondarySource'));
  const uiTraceMutation = tasks.replace('; UI ALL_UI_ROUTES;', '; UI secondarySource, ALL_UI_ROUTES;');
  assert.ok(deferredFindings(executableTaskSurfaces(uiTraceMutation)).some((finding) => finding.kind === 'traceUi' && finding.value === 'secondarySource'));
  const evidenceMutation = tasks.replace('; evidence E01, E02, E17.', '; evidence secondarySource, E01, E02, E17.');
  assert.ok(deferredFindings(executableTaskSurfaces(evidenceMutation)).some((finding) => finding.kind === 'traceEvidence' && finding.value === 'secondarySource'));
  const headerMutation = tasks.replace('Create executable contract and traceability guard tests', 'Create SecondarySource contract tests');
  assert.ok(deferredFindings(executableTaskSurfaces(headerMutation)).some((finding) => finding.kind === 'taskHeaders'));
});


test('every previously missed deferred identifier form is rejected in its structured contexts', () => {
  const propertyForms = ['secondaryShipmentSource', 'secondarySource', 'multipleShipmentSources'];
  for (const name of propertyForms) {
    const mutated = structuredClone(api);
    mutated.components.schemas.DeferredNestedProbe = { type: 'object', properties: { wrapper: { type: 'object', properties: { [name]: { type: 'string' } } } } };
    assert.ok(deferredFindings(openApiSurfaces(mutated)).some((finding) => finding.kind === 'propertyNames' && finding.value.endsWith('.' + name)), 'nested property escaped detection: ' + name);
  }
  for (const name of ['addSecondaryShipmentSource', 'claimSettlement']) {
    const operationMutation = structuredClone(api);
    operationMutation.paths['/deferred-probe-' + name] = { post: { operationId: name, 'x-required-roles': ['OWNER_ADMIN'] } };
    assert.ok(deferredFindings(openApiSurfaces(operationMutation)).some((finding) => finding.kind === 'operationIds' && finding.value === name), 'operation escaped detection: ' + name);
    const actionMutation = structuredClone(api);
    actionMutation.components.schemas.DeferredActionProbe = { type: 'object', action: name };
    assert.ok(deferredFindings(openApiSurfaces(actionMutation)).some((finding) => finding.kind === 'actionIdentifiers' && finding.value.endsWith(':' + name)), 'action escaped detection: ' + name);
  }
  const forms = ['secondaryShipmentSource', 'secondarySource', 'addSecondaryShipmentSource', 'multipleShipmentSources', 'claimSettlement'];
  for (const name of forms) {
    const uiMutation = ui.replace('| `/projects` | Project list |', '| `/projects` | Project list | `' + name + '`;');
    assert.ok(deferredFindings(uiSurfaces(uiMutation)).some((finding) => finding.kind === 'uiControlIdentifiers' && finding.value.includes(name)), 'UI control escaped detection: ' + name);
    const taskMutation = tasks.replace('; operations listMasterRecords,', '; operations ' + name + ', listMasterRecords,');
    assert.ok(deferredFindings(executableTaskSurfaces(taskMutation)).some((finding) => finding.kind === 'traceOperations' && finding.value === name), 'task identifier escaped detection: ' + name);
  }
});

test('deferred prose decoys outside structured active identifiers do not cause findings', () => {
  const proseOnly = ui + '\nSecondarySource and claimSettlement are mentioned here only as forbidden prose.\n';
  assert.deepEqual(deferredFindings(uiSurfaces(proseOnly)), deferredFindings(uiSurfaces(ui)));
});
