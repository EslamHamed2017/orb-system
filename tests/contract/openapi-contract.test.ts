import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OPENAPI = resolve(ROOT, 'specs/001-orb-trade-operations/contracts/openapi.yaml');
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const ROLES = new Set(['OWNER_ADMIN', 'OPERATIONS', 'FINANCE_VIEWER']);
const REF = '$ref';
const roleGroups = [
  [['OWNER_ADMIN', 'OPERATIONS', 'FINANCE_VIEWER'], ['listMasterRecords', 'listProjects', 'getProject', 'getFixedRouteChecklist', 'getEvidenceMetadata', 'viewOrDownloadEvidence', 'getDocumentGenerationStatus', 'getOperationalStatement', 'getProjectMarginAndCash', 'requestClosureException', 'submitFinalCloseForApproval', 'submitReopenForApproval', 'listProjectAuditEvents', 'listSupplierShipmentDatasetHistory', 'listSalesShipmentDatasetHistory', 'getOutboundManifestExactPreview', 'listOutboundSendAttempts', 'signOutCurrentSession', 'getSupplierShipmentWorkspace', 'getSalesShipmentWorkspace']],
  [['OWNER_ADMIN', 'OPERATIONS'], ['createMasterRecord', 'updateMasterRecord', 'createProjectWithSalesContract', 'createPurchaseContract', 'createContractAmendment', 'submitContractForApproval', 'createSupplierShipment', 'submitSupplierShipmentConfirmation', 'confirmSupplierShipment', 'createSalesShipment', 'setPrimarySupplierSource', 'requestToleranceException', 'confirmSalesShipment', 'updateRouteEvidenceOrMilestone', 'uploadEvidence', 'generateShipmentDocument', 'reviseDocument', 'submitDocumentForApproval', 'cancelDocumentRevision', 'createOutboundManifest', 'submitOutboundManifestForApproval', 'sendApprovedOutboundManifest', 'cancelOutboundManifest', 'createDirectExpense', 'submitDirectExpense', 'openSimpleClaim', 'moveClaimUnderReview', 'submitClaimOutcomeForApproval', 'assessProjectClosure', 'reviseSupplierShipmentDataset', 'reviseSalesShipmentDataset', 'transitionSupplierShipmentExecution', 'transitionSalesShipmentExecution', 'submitApprovedExpenseCorrection', 'applyApprovedExpenseCorrection', 'applyApprovedClaimOutcome', 'reviseOutboundManifest', 'submitSalesShipmentConfirmation']],
  [['OWNER_ADMIN'], ['listFixedApprovalInbox', 'decideFixedApproval', 'finalCloseProject', 'reopenProject', 'cancelUnexecutedProject', 'listPilotUsers', 'assignFixedPilotRoles', 'revokePilotUserSession', 'getBackupRecoveryStatus', 'startIsolatedRestoreTest', 'getIsolatedRestoreTest', 'listPilotUserSessions']],
  [['OWNER_ADMIN', 'FINANCE_VIEWER'], ['createSupplierInvoice', 'submitSupplierInvoice', 'confirmSupplierInvoice', 'recordMoneyMovement', 'allocateMoneyMovement', 'reverseMoneyMovement', 'reverseSettlementAllocation', 'cancelUnallocatedSupplierInvoice']],
  [[], ['signIn']],
];
const EXPECTED_ROLES = new Map(roleGroups.flatMap(([roles, ids]) => ids.map((id) => [id, [...roles].sort()])));
const MUTATION_IDS = new Set(['createMasterRecord', 'updateMasterRecord', 'createProjectWithSalesContract', 'createPurchaseContract', 'createContractAmendment', 'submitContractForApproval', 'createSupplierShipment', 'submitSupplierShipmentConfirmation', 'confirmSupplierShipment', 'createSalesShipment', 'setPrimarySupplierSource', 'requestToleranceException', 'confirmSalesShipment', 'updateRouteEvidenceOrMilestone', 'uploadEvidence', 'generateShipmentDocument', 'reviseDocument', 'submitDocumentForApproval', 'cancelDocumentRevision', 'createOutboundManifest', 'submitOutboundManifestForApproval', 'sendApprovedOutboundManifest', 'cancelOutboundManifest', 'decideFixedApproval', 'createSupplierInvoice', 'submitSupplierInvoice', 'confirmSupplierInvoice', 'recordMoneyMovement', 'allocateMoneyMovement', 'reverseMoneyMovement', 'createDirectExpense', 'submitDirectExpense', 'openSimpleClaim', 'moveClaimUnderReview', 'submitClaimOutcomeForApproval', 'assessProjectClosure', 'requestClosureException', 'finalCloseProject', 'submitFinalCloseForApproval', 'reopenProject', 'submitReopenForApproval', 'reviseSupplierShipmentDataset', 'reviseSalesShipmentDataset', 'transitionSupplierShipmentExecution', 'transitionSalesShipmentExecution', 'reverseSettlementAllocation', 'submitApprovedExpenseCorrection', 'applyApprovedExpenseCorrection', 'cancelUnexecutedProject', 'applyApprovedClaimOutcome', 'reviseOutboundManifest', 'submitSalesShipmentConfirmation', 'cancelUnallocatedSupplierInvoice', 'signIn', 'signOutCurrentSession', 'assignFixedPilotRoles', 'revokePilotUserSession', 'startIsolatedRestoreTest']);
const NO_IF_MATCH = new Set(['createMasterRecord', 'createProjectWithSalesContract', 'uploadEvidence', 'signIn', 'startIsolatedRestoreTest']);
const CONTROL = {
  'Idempotency-Key': { component: 'IdempotencyKey', required: MUTATION_IDS, minLength: 16, maxLength: 128 },
  'X-CSRF-Token': { component: 'CsrfToken', required: new Set([...MUTATION_IDS].filter((id) => id !== 'signIn')), minLength: 32, maxLength: 256 },
  'If-Match': { component: 'IfMatch', required: new Set([...MUTATION_IDS].filter((id) => !NO_IF_MATCH.has(id))), pattern: '^"[1-9][0-9]*"$' },
};

/** Deterministic, dependency-free parser for the conservative YAML subset used by the contract. */
export function parseYaml(source) {
  if (typeof source !== 'string') throw new TypeError('YAML source must be a string');
  if (/\t/.test(source)) throw new SyntaxError('YAML tabs are unsupported');
  const original = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n'), physical = [], lines = [];
  function openQuote(value, initial = '') {
    let quote = initial, escaped = false;
    for (let i = 0; i < value.length; i++) { const ch = value[i]; if (quote === '"' && escaped) { escaped = false; continue; } if (quote === '"' && ch === '\\') { escaped = true; continue; } if (quote) { if (ch === quote) { if (quote === "'" && value[i + 1] === "'") i++; else quote = ''; } } else if (ch === '"' || ch === "'") quote = ch; }
    return quote;
  }
  for (let i = 0; i < original.length; i++) { let value = original[i], quote = openQuote(value); while (quote && i + 1 < original.length) { value += ' ' + original[++i].trim(); quote = openQuote(original[i], quote); } if (quote) throw new SyntaxError('Unclosed quoted scalar at line ' + (i + 1)); physical.push(value); }
  function clean(value, number) {
    let quote = '', escaped = false;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && ch === '\\') { escaped = true; continue; }
      if (quote) { if (ch === quote) { if (quote === "'" && value[i + 1] === "'") i++; else quote = ''; } continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).trimEnd();
    }
    if (quote) throw new SyntaxError('Unclosed YAML token at line ' + number);
    return value.trimEnd();
  }
  physical.forEach((raw, index) => {
    const match = raw.match(/^( *)(.*)$/), content = clean(match[2], index + 1);
    if (!content.trim()) return;
    if (/^(?:---|\.\.\.|%YAML(?:\s|$)|%TAG(?:\s|$))/.test(content)) throw new SyntaxError('YAML directives/documents are unsupported at line ' + (index + 1));
    lines.push({ indent: match[1].length, content, number: index + 1 });
  });
  if (!lines.length) throw new SyntaxError('Empty YAML document');
  let cursor = 0;
  function colon(value) {
    let quote = '', escaped = false, depth = 0;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && ch === '\\') { escaped = true; continue; }
      if (quote) { if (ch === quote) { if (quote === "'" && value[i + 1] === "'") i++; else quote = ''; } continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
      else if (ch === ':' && depth === 0 && (i + 1 === value.length || /\s/.test(value[i + 1]))) return i;
    }
    return -1;
  }
  function parseFlow(text, number) {
    let index = 0;
    const fail = (message) => { throw new SyntaxError(message + ' at line ' + number); };
    const space = () => { while (/\s/.test(text[index] || '')) index++; };
    function quoted() {
      const quote = text[index++]; let token = quote, escaped = false;
      while (index < text.length) {
        const ch = text[index++]; token += ch;
        if (quote === '"') {
          if (escaped) escaped = false; else if (ch === '\\') escaped = true;
          else if (ch === quote) { try { return JSON.parse(token); } catch { fail('Invalid double-quoted scalar'); } }
        } else if (ch === quote) {
          if (text[index] === quote) { token += text[index++]; continue; }
          return token.slice(1, -1).replace(/''/g, "'");
        }
      }
      fail('Unclosed quoted scalar');
    }
    function scalar(stops) {
      space(); if (text[index] === '"' || text[index] === "'") return quoted();
      const start = index; while (index < text.length && !stops.includes(text[index])) index++;
      const token = text.slice(start, index).trim(); if (!token) fail('Missing scalar');
      if (/^[!&*]/.test(token)) fail('YAML tags, anchors and aliases are unsupported');
      if (/^(?:null|~)$/i.test(token)) return null;
      if (/^(?:true|false)$/i.test(token)) return token.toLowerCase() === 'true';
      if (/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token)) { const value = Number(token); if (!Number.isFinite(value)) fail('Non-finite number'); return value; }
      if (/^(?:yes|no|on|off)$/i.test(token) || /^[-+]?0\d+$/.test(token)) fail('Ambiguous YAML scalar is unsupported');
      return token;
    }
    function value(nested = false) {
      space();
      if (text[index] === '[') {
        index++; const result = []; space(); if (text[index] === ']') { index++; return result; }
        while (true) { result.push(value(true)); space(); if (text[index] === ']') { index++; return result; } if (text[index++] !== ',') fail('Expected comma or ]'); space(); if (text[index] === ']') fail('Trailing flow comma unsupported'); }
      }
      if (text[index] === '{') {
        index++; const result = Object.create(null); space(); if (text[index] === '}') { index++; return result; }
        while (true) {
          const key = scalar(':'); space(); if (text[index++] !== ':') fail('Expected mapping colon');
          if (typeof key !== 'string' || !key) fail('Mapping key must be a non-empty string'); if (Object.hasOwn(result, key)) fail('Duplicate key ' + key);
          result[key] = value(true); space(); if (text[index] === '}') { index++; return result; } if (text[index++] !== ',') fail('Expected comma or }'); space(); if (text[index] === '}') fail('Trailing flow comma unsupported');
        }
      }
      return scalar(nested ? ',]}' : '');
    }
    const result = value(); space(); if (index !== text.length) fail('Unexpected flow content'); return result;
  }
  function key(text, number) { const result = parseFlow(text.trim(), number); if (typeof result !== 'string' || !result) throw new SyntaxError('Mapping key must be a non-empty string at line ' + number); return result; }
  function blockScalar(marker, parentIndent, number) {
    if (!/^[>|][+-]?$/.test(marker)) throw new SyntaxError('Unsupported block scalar indicator at line ' + number);
    const parts = []; let minimum = Infinity;
    while (cursor < lines.length && lines[cursor].indent > parentIndent) { minimum = Math.min(minimum, lines[cursor].indent); parts.push(lines[cursor++]); }
    const body = parts.map((line) => ' '.repeat(line.indent - minimum) + line.content);
    let result = marker[0] === '|' ? body.join('\n') : body.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ');
    if (!marker.endsWith('-')) result += '\n'; return result;
  }
  function assign(object, name, rest, indent, number) {
    if (Object.hasOwn(object, name)) throw new SyntaxError('Duplicate key ' + name + ' at line ' + number);
    if (!rest) object[name] = cursor >= lines.length || lines[cursor].indent < indent || (lines[cursor].indent === indent && !/^-(?:\s|$)/.test(lines[cursor].content)) ? null : parseBlock(lines[cursor].indent);
    else if (/^[>|]/.test(rest)) object[name] = blockScalar(rest, indent, number);
    else {
      object[name] = parseFlow(rest, number); const continuation = [];
      while (cursor < lines.length && lines[cursor].indent > indent && !/^-(?:\s|$)/.test(lines[cursor].content) && colon(lines[cursor].content) < 0) continuation.push(lines[cursor++].content.trim());
      if (continuation.length) { if (typeof object[name] !== 'string') throw new SyntaxError('Scalar continuation requires text at line ' + number); object[name] += ' ' + continuation.join(' '); }
    }
  }
  function mapping(indent, seed = Object.create(null)) {
    while (cursor < lines.length && lines[cursor].indent === indent && !/^-(?:\s|$)/.test(lines[cursor].content)) {
      const line = lines[cursor++], split = colon(line.content); if (split < 1) throw new SyntaxError('Expected mapping at line ' + line.number);
      assign(seed, key(line.content.slice(0, split), line.number), line.content.slice(split + 1).trim(), indent, line.number);
    }
    return seed;
  }
  function sequence(indent) {
    const result = [];
    while (cursor < lines.length && lines[cursor].indent === indent && /^-(?:\s|$)/.test(lines[cursor].content)) {
      const line = lines[cursor++], rest = line.content.slice(1).trim();
      if (!rest) { result.push(cursor >= lines.length || lines[cursor].indent <= indent ? null : parseBlock(lines[cursor].indent)); continue; }
      const split = colon(rest);
      if (split > 0) {
        const item = Object.create(null); assign(item, key(rest.slice(0, split), line.number), rest.slice(split + 1).trim(), indent, line.number);
        if (cursor < lines.length && lines[cursor].indent > indent) mapping(lines[cursor].indent, item); result.push(item);
      } else { result.push(parseFlow(rest, line.number)); if (cursor < lines.length && lines[cursor].indent > indent) throw new SyntaxError('Scalar sequence item cannot have children at line ' + lines[cursor].number); }
    }
    return result;
  }
  function parseBlock(indent) {
    if (cursor >= lines.length || lines[cursor].indent !== indent) throw new SyntaxError('Invalid indentation at line ' + (lines[cursor]?.number || physical.length));
    const isSequence = /^-(?:\s|$)/.test(lines[cursor].content), result = isSequence ? sequence(indent) : mapping(indent);
    if (cursor < lines.length && lines[cursor].indent > indent) throw new SyntaxError('Unexpected indentation at line ' + lines[cursor].number);
    return result;
  }
  const result = parseBlock(lines[0].indent); if (cursor !== lines.length) throw new SyntaxError('Unparsed YAML at line ' + lines[cursor].number); return result;
}
function pointerValue(document, reference) {
  assert.match(reference, /^#\//, 'Only local JSON Pointer refs are accepted: ' + reference);
  let current = document;
  for (const raw of reference.slice(2).split('/')) {
    const token = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    assert.ok(current !== null && typeof current === 'object' && Object.hasOwn(current, token), 'Unresolvable local ref: ' + reference);
    current = current[token];
  }
  return current;
}
function validateAndCountLocalRefs(document) {
  let count = 0;
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, REF)) { assert.equal(typeof value[REF], 'string'); pointerValue(document, value[REF]); count++; }
    Object.values(value).forEach(visit);
  };
  visit(document); return count;
}
function operations(document) {
  const result = [];
  for (const [path, pathItem] of Object.entries(document.paths || {})) for (const [method, operation] of Object.entries(pathItem || {}))
    if (HTTP_METHODS.has(method.toLowerCase())) result.push({ path, method: method.toLowerCase(), pathItem, operation });
  return result;
}
function canonicalSet(values) { return [...values].sort(); }
function setDiff(expected, actual) { return { missing: canonicalSet([...expected].filter((x) => !actual.has(x))), unexpected: canonicalSet([...actual].filter((x) => !expected.has(x))) }; }
function contractViolations(document) {
  const errors = [];
  const entries = operations(document);
  const ids = entries.map(({ operation }) => operation.operationId);
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) errors.push('empty operationId');
  if (new Set(ids).size !== ids.length) errors.push('duplicate operationId');
  const actualIds = new Set(ids);
  const idDiff = setDiff(new Set(EXPECTED_ROLES.keys()), actualIds);
  if (idDiff.missing.length || idDiff.unexpected.length) errors.push('operation inventory mismatch ' + JSON.stringify(idDiff));
  for (const { operation } of entries) {
    const id = operation.operationId || '<missing>', roles = operation['x-required-roles'];
    if (!Array.isArray(roles)) { errors.push(id + ': missing/non-array x-required-roles'); continue; }
    if (new Set(roles).size !== roles.length) errors.push(id + ': duplicate role');
    if (roles.some((role) => !ROLES.has(role))) errors.push(id + ': unknown role');
    const expected = EXPECTED_ROLES.get(id);
    if (expected && JSON.stringify(canonicalSet(roles)) !== JSON.stringify(expected))
      errors.push(id + ': roles changed expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(canonicalSet(roles)));
  }
  return errors;
}
function controlViolations(document) {
  const errors = [];
  const entries = operations(document);
  const actualMutations = new Set(entries.filter(({ method }) => !['get', 'head', 'options'].includes(method)).map(({ operation }) => operation.operationId));
  const mutationDiff = setDiff(MUTATION_IDS, actualMutations);
  if (mutationDiff.missing.length || mutationDiff.unexpected.length) errors.push('mutation inventory mismatch ' + JSON.stringify(mutationDiff));
  for (const [name, rule] of Object.entries(CONTROL)) {
    const component = document.components?.parameters?.[rule.component];
    if (!component || component.name !== name || component.in !== 'header' || component.required !== true || component.schema?.type !== 'string')
      errors.push(name + ': invalid component header semantics');
    if (rule.minLength !== undefined && (component?.schema?.minLength !== rule.minLength || component?.schema?.maxLength !== rule.maxLength)) errors.push(name + ': invalid string bounds');
    if (rule.pattern !== undefined && component?.schema?.pattern !== rule.pattern) errors.push(name + ': invalid string pattern');
    const actual = new Set();
    for (const entry of entries) {
      const params = [...(entry.pathItem.parameters || []), ...(entry.operation.parameters || [])];
      const matching = params.filter((p) => p?.[REF] === '#/components/parameters/' + rule.component || p?.name === name);
      if (matching.length) actual.add(entry.operation.operationId);
      if (matching.length > 1) errors.push(entry.operation.operationId + ': duplicate ' + name);
      for (const parameter of matching) {
        if (parameter?.[REF] !== '#/components/parameters/' + rule.component || Object.keys(parameter).length !== 1)
          errors.push(entry.operation.operationId + ': ' + name + ' must use exact component ref');
        let resolved;
        try { resolved = pointerValue(document, parameter[REF]); } catch (error) { errors.push(entry.operation.operationId + ': ' + error.message); continue; }
        if (resolved.name !== name || resolved.in !== 'header' || resolved.required !== true || resolved.schema?.type !== 'string')
          errors.push(entry.operation.operationId + ': invalid resolved ' + name + ' semantics');
      }
    }
    const diff = setDiff(rule.required, actual);
    if (diff.missing.length || diff.unexpected.length) errors.push(name + ': operation set mismatch ' + JSON.stringify(diff));
  }
  return errors;
}
function operation(document, id) { return operations(document).find((entry) => entry.operation.operationId === id).operation; }
const document = parseYaml(readFileSync(OPENAPI, 'utf8'));

test('YAML subset parser covers mappings, sequences, scalars, flow collections, comments, escaped keys and block scalars', () => {
  const parsed = parseYaml(`root:
  "escaped\\nkey": [true, false, null, -12.5e2, "x#y"] # comment
  sequence:
  - name: first
    values: {one: 1, "two:key": 2}
  literal: |-
    alpha
    beta
  folded: >
    gamma
    delta
safe:
  __proto__: inert
`);
  assert.deepEqual(parsed.root['escaped\nkey'], [true, false, null, -1250, 'x#y']);
  assert.deepEqual({ ...parsed.root.sequence[0].values }, { one: 1, 'two:key': 2 });
  assert.equal(parsed.root.literal, 'alpha\nbeta'); assert.equal(parsed.root.folded, 'gamma delta\n');
  assert.equal(parsed.safe.__proto__, 'inert'); assert.equal(Object.getPrototypeOf(parsed.safe), null);
});
test('YAML subset parser fails closed on malformed, duplicate, ambiguous and unsupported syntax', () => {
  const rejected = [
    '', 'a:\n\tb: 1', '---\na: 1', 'a: &anchor 1', 'a: *anchor', 'a: !tag value',
    'a: 1\na: 2', 'a: [1,]', 'a: yes', 'a:\n    b: 1\n  c: 2', '? [a, b]\n: value',
    'a: |2\n  value', 'a: "unterminated', 'a: {x: 1, x: 2}',
  ];
  for (const fixture of rejected) assert.throws(() => parseYaml(fixture), SyntaxError, JSON.stringify(fixture));
});

test('accepted OpenAPI 3.1 surface and every local ref are pinned', () => {
  assert.match(document.openapi, /^3\.1(?:\.|$)/); assert.equal(Object.keys(document.paths).length, 75);
  assert.equal(operations(document).length, 79); assert.equal(validateAndCountLocalRefs(document), 745);
});
test('all operations have exact operation-specific role assignments', () => {
  assert.equal(EXPECTED_ROLES.size, 79); assert.deepEqual(contractViolations(document), []);
  const snapshot = [...EXPECTED_ROLES].sort(([a], [b]) => a.localeCompare(b));
  assert.equal(createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), '0192cdb0bf8e8438c798b6ff0377682a213283283dc5749a762b312b8bd94cba');
});
test('request controls have exact semantic component refs and operation inventories', () => {
  assert.equal(MUTATION_IDS.size, 58); assert.equal(CONTROL['X-CSRF-Token'].required.size, 57); assert.equal(CONTROL['If-Match'].required.size, 53);
  assert.deepEqual(controlViolations(document), []);
});
test('role narrowing and broadening mutations fail closed', () => {
  const narrow = structuredClone(document); operation(narrow, 'listMasterRecords')['x-required-roles'] = ['OWNER_ADMIN'];
  assert.match(contractViolations(narrow).join('\n'), /listMasterRecords: roles changed/);
  const broad = structuredClone(document); operation(broad, 'listPilotUsers')['x-required-roles'] = ['OWNER_ADMIN', 'OPERATIONS'];
  assert.match(contractViolations(broad).join('\n'), /listPilotUsers: roles changed/);
});
test('control semantic and inventory mutation probes fail closed', () => {
  const cases = [];
  const moved = structuredClone(document); moved.components.parameters.IdempotencyKey.in = 'query'; cases.push([moved, /invalid component header semantics/]);
  const optional = structuredClone(document); optional.components.parameters.CsrfToken.required = false; cases.push([optional, /invalid component header semantics/]);
  const schema = structuredClone(document); schema.components.parameters.IfMatch.schema = { type: 'integer' }; cases.push([schema, /invalid component header semantics|invalid string pattern/]);
  const omitted = structuredClone(document); operation(omitted, 'createMasterRecord').parameters = operation(omitted, 'createMasterRecord').parameters.filter((p) => p[REF] !== '#/components/parameters/IdempotencyKey'); cases.push([omitted, /Idempotency-Key: operation set mismatch/]);
  const added = structuredClone(document); operation(added, 'signIn').parameters.push({ [REF]: '#/components/parameters/IfMatch' }); cases.push([added, /If-Match: operation set mismatch/]);
  const inline = structuredClone(document); const target = operation(inline, 'createMasterRecord').parameters.findIndex((p) => p[REF] === '#/components/parameters/CsrfToken'); operation(inline, 'createMasterRecord').parameters[target] = structuredClone(inline.components.parameters.CsrfToken); cases.push([inline, /must use exact component ref/]);
  for (const [mutated, expected] of cases) assert.match(controlViolations(mutated).join('\n'), expected);
});
test('broken refs, duplicate IDs, missing and duplicate roles fail closed', () => {
  const broken = structuredClone(document); broken.paths['/projects'].get.responses['200'] = { [REF]: '#/components/responses/DoesNotExist' }; assert.throws(() => validateAndCountLocalRefs(broken), /Unresolvable/);
  const duplicate = structuredClone(document); const entries = operations(duplicate); entries[1].operation.operationId = entries[0].operation.operationId; assert.match(contractViolations(duplicate).join('\n'), /duplicate operationId/);
  const missing = structuredClone(document); delete operation(missing, 'listProjects')['x-required-roles']; assert.match(contractViolations(missing).join('\n'), /missing\/non-array/);
  const duplicateRole = structuredClone(document); operation(duplicateRole, 'listPilotUsers')['x-required-roles'].push('OWNER_ADMIN'); assert.match(contractViolations(duplicateRole).join('\n'), /duplicate role/);
});
