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
  const rawLines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const records = [];
  function quoteState(value, initial = '') {
    let quote = initial, escaped = false;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && ch === '\\') { escaped = true; continue; }
      if (quote) { if (ch === quote) { if (quote === "'" && value[i + 1] === "'") i++; else quote = ''; } }
      else if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]))) break;
      else if (ch === '"' || ch === "'") quote = ch;
    }
    return quote;
  }
  let blockParent = null;
  for (let i = 0; i < rawLines.length; i++) {
    let raw = rawLines[i], match = raw.match(/^( *)(.*)$/), indent = match[1].length;
    if (blockParent !== null) {
      if (!raw.trim() || indent > blockParent) { records.push({ raw, indent, body: match[2], number: i + 1 }); continue; }
      blockParent = null;
    }
    const number = i + 1; let quote = quoteState(match[2]);
    while (quote && i + 1 < rawLines.length) { raw += ' ' + rawLines[++i].trim(); quote = quoteState(rawLines[i], quote); }
    match = raw.match(/^( *)(.*)$/); records.push({ raw, indent: match[1].length, body: match[2], number });
    if (/:[ \t]*[>|][+-]?[ \t]*(?:#.*)?$/.test(match[2])) blockParent = match[1].length;
  }
  let cursor = 0;
  function fail(message, number = records[cursor]?.number || rawLines.length) { throw new SyntaxError(message + ' at line ' + number); }
  function stripComment(value, number) {
    let quote = '', escaped = false;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && ch === '\\') { escaped = true; continue; }
      if (quote) {
        if (ch === quote) { if (quote === "'" && value[i + 1] === "'") i++; else quote = ''; }
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).trimEnd();
    }
    if (quote) fail('Multiline or unclosed quoted scalar is unsupported', number);
    return value.trimEnd();
  }
  function inspected(record) {
    if (record.inspected) return record;
    record.inspected = true;
    record.content = stripComment(record.body, record.number);
    record.trivia = !record.content.trim();
    if (!record.trivia && /^(?:---|\.\.\.|%YAML(?:\s|$)|%TAG(?:\s|$))/.test(record.content)) fail('YAML directives/documents are unsupported', record.number);
    return record;
  }
  function skipTrivia() { while (cursor < records.length && inspected(records[cursor]).trivia) cursor++; }
  function colon(value) {
    let quote = '', escaped = false, depth = 0;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && ch === '\\') { escaped = true; continue; }
      if (quote) { if (ch === quote) { if (quote === "'" && value[i + 1] === "'") i++; else quote = ''; } continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') { depth--; if (depth < 0) return -1; }
      else if (ch === ':' && depth === 0 && (i + 1 === value.length || /\s/.test(value[i + 1]))) return i;
    }
    return -1;
  }
  function parseFlow(text, number) {
    let index = 0;
    const bad = (message) => fail(message, number);
    const space = () => { while (/\s/.test(text[index] || '')) index++; };
    function quoted() {
      const quote = text[index++]; let token = quote, escaped = false;
      while (index < text.length) {
        const ch = text[index++]; token += ch;
        if (quote === '"') {
          if (escaped) escaped = false; else if (ch === '\\') escaped = true;
          else if (ch === quote) { try { return JSON.parse(token); } catch { bad('Invalid double-quoted scalar'); } }
        } else if (ch === quote) {
          if (text[index] === quote) { token += text[index++]; continue; }
          return token.slice(1, -1).replace(/''/g, "'");
        }
      }
      bad('Unclosed quoted scalar');
    }
    function plain(stops) {
      space();
      const start = index; while (index < text.length && !stops.includes(text[index])) index++;
      const token = text.slice(start, index).trim();
      if (!token) bad('Missing scalar');
      if (/(^|\s)[!&*](?=\S)/.test(token)) bad('YAML tags, anchors and aliases are unsupported');
      if (/:\s/.test(token)) bad('Colon followed by whitespace in a plain scalar is unsupported');
      if (/^(?:null|~)$/i.test(token)) return null;
      if (/^(?:true|false)$/i.test(token)) return token.toLowerCase() === 'true';
      if (/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token)) { const value = Number(token); if (!Number.isFinite(value)) bad('Non-finite number'); return value; }
      if (/^(?:yes|no|on|off|\.nan|[-+]?\.inf)$/i.test(token) || /^[-+]?0\d+$/.test(token)) bad('Ambiguous YAML scalar is unsupported');
      if (/^[?:-](?:\s|$)/.test(token)) bad('Ambiguous YAML construct is unsupported');
      return token;
    }
    function value(nested = false) {
      space();
      if (text[index] === '"' || text[index] === "'") return quoted();
      if (text[index] === '[') {
        index++; const result = []; space(); if (text[index] === ']') { index++; return result; }
        while (true) { result.push(value(true)); space(); if (text[index] === ']') { index++; return result; } if (text[index++] !== ',') bad('Expected comma or ]'); space(); if (text[index] === ']') bad('Trailing flow comma unsupported'); }
      }
      if (text[index] === '{') {
        index++; const result = Object.create(null); space(); if (text[index] === '}') { index++; return result; }
        while (true) {
          const name = value(true); space(); if (text[index++] !== ':') bad('Expected mapping colon');
          if (typeof name !== 'string' || !name) bad('Mapping key must be a non-empty string');
          if (Object.hasOwn(result, name)) bad('Duplicate key ' + name);
          result[name] = value(true); space(); if (text[index] === '}') { index++; return result; }
          if (text[index++] !== ',') bad('Expected comma or }'); space(); if (text[index] === '}') bad('Trailing flow comma unsupported');
        }
      }
      return plain(nested ? ',]}:' : '');
    }
    const result = value(); space(); if (index !== text.length) bad('Unexpected flow content'); return result;
  }
  function parseKey(text, number) {
    const result = parseFlow(text.trim(), number);
    if (typeof result !== 'string' || !result) fail('Mapping key must be a non-empty string', number);
    return result;
  }
  function blockScalar(marker, parentIndent, number) {
    if (!/^[>|][+-]?$/.test(marker)) fail('Unsupported block scalar indicator', number);
    const start = cursor; let contentIndent = null, end = cursor;
    while (end < records.length) {
      const record = records[end];
      if (!record.raw.trim()) { end++; continue; }
      if (record.indent <= parentIndent) break;
      if (contentIndent === null) contentIndent = record.indent;
      if (record.indent < contentIndent) break;
      end++;
    }
    if (contentIndent === null) { cursor = end; return ''; }
    const body = [];
    for (let i = start; i < end; i++) {
      const record = records[i];
      if (i === records.length - 1 && record.raw === '' && source.endsWith('\n')) continue;
      if (!record.raw.trim()) body.push('');
      else {
        if (record.indent < contentIndent) fail('Malformed block scalar indentation', record.number);
        body.push(record.raw.slice(contentIndent));
      }
    }
    cursor = end;
    if (marker[0] === '>' && body.some((line) => line === '' || /^\s/.test(line))) fail('Complex folded block scalars are unsupported', number);
    let result = (marker[0] === '|' ? body.join('\n') : body.join(' ')) + (body.length ? '\n' : '');
    if (marker.endsWith('-')) result = result.replace(/\n+$/, '');
    else if (!marker.endsWith('+')) result = result.replace(/\n+$/, '') + (body.length ? '\n' : '');
    return result;
  }
  function assign(object, name, rest, indent, number) {
    if (Object.hasOwn(object, name)) fail('Duplicate key ' + name, number);
    if (!rest) {
      skipTrivia();
      object[name] = cursor < records.length && (inspected(records[cursor]).indent > indent || (records[cursor].indent === indent && /^-(?:\s|$)/.test(records[cursor].content))) ? parseBlock(records[cursor].indent) : null;
    } else if (/^[>|]/.test(rest)) object[name] = blockScalar(rest, indent, number);
    else {
      object[name] = parseFlow(rest, number);
      const continuation = [];
      while (cursor < records.length) {
        const next = inspected(records[cursor]);
        if (next.trivia || next.indent <= indent || /^-(?:\s|$)/.test(next.content) || colon(next.content) >= 0) break;
        continuation.push(next.content.trim()); cursor++;
      }
      if (continuation.length) {
        if (typeof object[name] !== 'string') fail('Scalar continuation requires text', number);
        object[name] += ' ' + continuation.join(' ');
      }
    }
  }
  function mapping(indent, seed = Object.create(null)) {
    while (true) {
      skipTrivia(); if (cursor >= records.length) break;
      const line = inspected(records[cursor]);
      if (line.indent !== indent || /^-(?:\s|$)/.test(line.content)) break;
      cursor++; const split = colon(line.content); if (split < 1) fail('Expected mapping', line.number);
      assign(seed, parseKey(line.content.slice(0, split), line.number), line.content.slice(split + 1).trim(), indent, line.number);
    }
    return seed;
  }
  function sequence(indent) {
    const result = [];
    while (true) {
      skipTrivia(); if (cursor >= records.length) break;
      const line = inspected(records[cursor]);
      if (line.indent !== indent || !/^-(?:\s|$)/.test(line.content)) break;
      cursor++; const rest = line.content.slice(1).trim();
      if (!rest) { skipTrivia(); result.push(cursor < records.length && inspected(records[cursor]).indent > indent ? parseBlock(records[cursor].indent) : null); continue; }
      const split = colon(rest);
      if (split > 0) {
        const item = Object.create(null); assign(item, parseKey(rest.slice(0, split), line.number), rest.slice(split + 1).trim(), indent, line.number);
        skipTrivia(); if (cursor < records.length && inspected(records[cursor]).indent > indent) mapping(records[cursor].indent, item);
        result.push(item);
      } else {
        result.push(parseFlow(rest, line.number)); skipTrivia();
        if (cursor < records.length && inspected(records[cursor]).indent > indent) fail('Scalar sequence item cannot have children', records[cursor].number);
      }
    }
    return result;
  }
  function parseBlock(indent) {
    skipTrivia();
    if (cursor >= records.length || inspected(records[cursor]).indent !== indent) fail('Invalid indentation');
    const isSequence = /^-(?:\s|$)/.test(records[cursor].content);
    const result = isSequence ? sequence(indent) : mapping(indent);
    skipTrivia(); if (cursor < records.length && inspected(records[cursor]).indent > indent) fail('Unexpected indentation', records[cursor].number);
    return result;
  }
  skipTrivia(); if (cursor >= records.length) fail('Empty YAML document', 1);
  if (records[cursor].indent !== 0) fail('Root indentation is unsupported', records[cursor].number);
  const result = parseBlock(0); skipTrivia();
  if (cursor !== records.length) fail('Unparsed YAML', records[cursor].number);
  return result;
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
  assert.equal(parseYaml('a: |-\n  # retained data').a, '# retained data');
  assert.equal(parseYaml('a: |-\n  first\n\n  third').a, 'first\n\nthird');
  assert.equal(parseYaml('a: |\n  x\n  # retained\n  z').a, 'x\n# retained\nz\n');
  assert.deepEqual({ ...parseYaml('a: |+\n  x\n\n\nb: y') }, { a: 'x\n\n\n', b: 'y' });
  assert.equal(parseYaml('a: |+\n  x\n\n').a, 'x\n\n');
  assert.equal(parseYaml('a: >-\n  first\n  second').a, 'first second');
  assert.equal(parseYaml('a: >\n  first\n  second').a, 'first second\n');
  assert.equal(parseYaml('a: >+\n  first\n  second').a, 'first second\n');
});
test('YAML subset parser fails closed on malformed, duplicate, ambiguous and unsupported syntax', () => {
  const rejected = [
    '', 'a:\n\tb: 1', '---\na: 1', 'a: &anchor 1', 'a: *anchor', 'a: !tag value',
    'a: 1\na: 2', 'a: [1,]', 'a: yes', 'a:\n    b: 1\n  c: 2', '? [a, b]\n: value',
    'a: |2\n  value', 'a: "unterminated', 'a: {x: 1, x: 2}', 'a: bad: scalar', 'a: 1\ntrailing garbage',
  ];
  for (const fixture of rejected) assert.throws(() => parseYaml(fixture), SyntaxError, JSON.stringify(fixture));
  const accepted = readFileSync(OPENAPI, 'utf8');
  assert.throws(() => parseYaml(accepted + '\nx-invalid-probe: bad: scalar\n'), /Colon followed by whitespace/);
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
