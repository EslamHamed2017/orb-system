const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = resolve(__dirname, '../..');
const OPENAPI = resolve(ROOT, 'specs/001-orb-trade-operations/contracts/openapi.yaml');
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const ROLES = new Set(['OWNER_ADMIN', 'OPERATIONS', 'FINANCE_VIEWER']);
const REF = String.fromCharCode(36) + 'ref';
const NO_IF_MATCH = new Set([
  'createMasterRecord', 'createProjectWithSalesContract', 'uploadEvidence', 'signIn',
  'startIsolatedRestoreTest',
]);

function parseYaml(path) {
  const program = [
    'import json, sys, yaml',
    'with open(sys.argv[1], encoding="utf-8") as stream:',
    '    value = yaml.safe_load(stream)',
    'print(json.dumps(value, separators=(",", ":"), default=str))',
  ].join('\n');
  return JSON.parse(execFileSync('python3', ['-c', program, path], { encoding: 'utf8' }));
}

function pointerValue(document, reference) {
  assert.match(reference, /^#\//, 'Only local JSON Pointer refs are accepted: ' + reference);
  let current = document;
  for (const raw of reference.slice(2).split('/')) {
    const token = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    assert.ok(current !== null && typeof current === 'object' && Object.hasOwn(current, token),
      'Unresolvable local ref: ' + reference);
    current = current[token];
  }
  return current;
}

function validateAndCountLocalRefs(document) {
  let count = 0;
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, REF)) {
      assert.equal(typeof value[REF], 'string', 'ref must be a string');
      pointerValue(document, value[REF]);
      count += 1;
    }
    Object.values(value).forEach(visit);
  };
  visit(document);
  return count;
}

function resolveLocal(document, value, chain = []) {
  if (Array.isArray(value)) return value.map((item) => resolveLocal(document, item, chain));
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, REF)) {
    const reference = value[REF];
    const target = pointerValue(document, reference);
    if (chain.includes(reference)) return { [REF]: reference };
    const siblings = Object.fromEntries(Object.entries(value).filter(([key]) => key !== REF));
    return resolveLocal(document, { ...target, ...siblings }, [...chain, reference]);
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) =>
    [key, resolveLocal(document, child, chain)]));
}

function operations(document) {
  const result = [];
  for (const [path, pathItem] of Object.entries(document.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (HTTP_METHODS.has(method.toLowerCase())) result.push({ path, method: method.toLowerCase(), pathItem, operation });
    }
  }
  return result;
}

function parameterNames(document, entry) {
  return [...(entry.pathItem.parameters || []), ...(entry.operation.parameters || [])]
    .map((parameter) => resolveLocal(document, parameter).name);
}

function contractViolations(document) {
  const errors = [];
  const entries = operations(document);
  const ids = entries.map(({ operation }) => operation.operationId);
  if (ids.some((id) => typeof id !== 'string' || id.trim() === '')) errors.push('empty operationId');
  if (new Set(ids).size !== ids.length) errors.push('duplicate operationId');
  for (const { operation } of entries) {
    const id = operation.operationId || '<missing>';
    if (!Object.hasOwn(operation, 'x-required-roles')) {
      errors.push(id + ': missing x-required-roles');
      continue;
    }
    const roles = operation['x-required-roles'];
    if (!Array.isArray(roles)) errors.push(id + ': x-required-roles is not an array');
    else if (id === 'signIn') {
      if (roles.length !== 0) errors.push('signIn must be public');
    } else if (roles.length === 0 || roles.some((role) => !ROLES.has(role))) {
      errors.push(id + ': invalid x-required-roles');
    }
  }
  return errors;
}

const document = parseYaml(OPENAPI);

test('accepted OpenAPI 3.1 surface and every local ref are pinned', () => {
  assert.match(document.openapi, /^3\.1(?:\.|$)/);
  assert.equal(Object.keys(document.paths).length, 75);
  assert.equal(operations(document).length, 79);
  assert.equal(validateAndCountLocalRefs(document), 745);
});

test('all 79 operations have unique IDs and explicit fixed roles', () => {
  assert.deepEqual(contractViolations(document), []);
  const ids = operations(document).map(({ operation }) => operation.operationId);
  assert.equal(ids.length, 79);
  assert.equal(new Set(ids).size, 79);
});

test('mutation request controls match the accepted contract', () => {
  const mutations = operations(document).filter(({ method }) => !['get', 'head', 'options'].includes(method));
  assert.equal(mutations.length, 58);
  const idempotent = mutations.filter((entry) => parameterNames(document, entry).includes('Idempotency-Key'));
  const csrf = mutations.filter((entry) => parameterNames(document, entry).includes('X-CSRF-Token'));
  const ifMatch = mutations.filter((entry) => parameterNames(document, entry).includes('If-Match'));
  assert.equal(idempotent.length, 58);
  assert.equal(csrf.length, 57);
  assert.equal(ifMatch.length, 53);
  assert.deepEqual(new Set(mutations.filter((entry) => !parameterNames(document, entry).includes('If-Match'))
    .map(({ operation }) => operation.operationId)), NO_IF_MATCH);
  assert.deepEqual(mutations.filter((entry) => !parameterNames(document, entry).includes('X-CSRF-Token'))
    .map(({ operation }) => operation.operationId), ['signIn']);
});

test('negative mutations fail closed for refs, duplicate IDs, and missing roles', () => {
  const brokenRef = structuredClone(document);
  brokenRef.paths['/projects'].get.responses['200'] = { [REF]: '#/components/responses/DoesNotExist' };
  assert.throws(() => validateAndCountLocalRefs(brokenRef), /Unresolvable local ref/);

  const duplicate = structuredClone(document);
  const entries = operations(duplicate);
  entries[1].operation.operationId = entries[0].operation.operationId;
  assert.ok(contractViolations(duplicate).includes('duplicate operationId'));

  const missingRole = structuredClone(document);
  delete operations(missingRole)[0].operation['x-required-roles'];
  assert.ok(contractViolations(missingRole).some((error) => error.includes('missing x-required-roles')));
});
