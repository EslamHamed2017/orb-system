import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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

function pythonPreflight() {
  const probe = 'import json,platform,yaml; print(json.dumps({"python":platform.python_version(),"pyyaml":yaml.__version__}))';
  let versions;
  try { versions = JSON.parse(execFileSync('python3', ['-c', probe], { encoding: 'utf8' })); }
  catch (error) { throw new Error('OpenAPI tests require executable python3 with PyYAML 6.0.1: ' + error.message); }
  assert.match(versions.python, /^3\.12\./, 'python3 must be pinned to Python 3.12.x');
  assert.equal(versions.pyyaml, '6.0.1', 'PyYAML must be pinned to 6.0.1');
}
function parseYaml(path) {
  pythonPreflight();
  const program = 'import json,sys,yaml\nwith open(sys.argv[1],encoding="utf-8") as f: value=yaml.safe_load(f)\nprint(json.dumps(value,separators=(",",":"),default=str))';
  return JSON.parse(execFileSync('python3', ['-c', program, path], { encoding: 'utf8' }));
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
const document = parseYaml(OPENAPI);

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
