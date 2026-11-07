export const R1_SECURITY_IDS = Object.freeze({
  owner: "00000000-0000-7000-8000-000000000001", operations: "00000000-0000-7000-8000-000000000002", finance: "00000000-0000-7000-8000-000000000003",
  ownerRole: "00000000-0000-7000-8000-000000000011", operationsRole: "00000000-0000-7000-8000-000000000012", financeRole: "00000000-0000-7000-8000-000000000013",
  ownerSession: "00000000-0000-7000-8000-000000000021", operationsSession: "00000000-0000-7000-8000-000000000022", financeSession: "00000000-0000-7000-8000-000000000023",
});
const updated_at = "2026-11-07T00:00:00.000Z";
export const R1_USERS = Object.freeze([
  { id:R1_SECURITY_IDS.owner, auth_subject:"r1-owner", name_ar:"مالك الإصدار التجريبي", name_en:"R1 Owner", locale:"en", status:"ACTIVE", mfa_state:"SATISFIED", created_at:updated_at, updated_at },
  { id:R1_SECURITY_IDS.operations, auth_subject:"r1-operations", name_ar:"عمليات الإصدار التجريبي", name_en:"R1 Operations", locale:"ar", status:"ACTIVE", mfa_state:"SATISFIED", created_at:updated_at, updated_at },
  { id:R1_SECURITY_IDS.finance, auth_subject:"r1-finance", name_ar:"مالية الإصدار التجريبي", name_en:"R1 Finance Viewer", locale:"en", status:"ACTIVE", mfa_state:"SATISFIED", created_at:updated_at, updated_at },
]);
export const R1_USER_ROLES = Object.freeze([
  {id:R1_SECURITY_IDS.ownerRole,user_id:R1_SECURITY_IDS.owner,role:"OWNER_ADMIN"},
  {id:R1_SECURITY_IDS.operationsRole,user_id:R1_SECURITY_IDS.operations,role:"OPERATIONS"},
  {id:R1_SECURITY_IDS.financeRole,user_id:R1_SECURITY_IDS.finance,role:"FINANCE_VIEWER"},
]);
export const R1_PILOT_SESSIONS = Object.freeze(R1_USERS.map((user,index)=>({
  id:[R1_SECURITY_IDS.ownerSession,R1_SECURITY_IDS.operationsSession,R1_SECURITY_IDS.financeSession][index], user_id:user.id,
  created_at:updated_at,last_seen_at:"2026-11-07T09:15:00.000Z",idle_expires_at:"2026-11-07T09:45:00.000Z",absolute_expires_at:"2026-11-07T12:00:00.000Z",
  revoked_at:null,revoked_by:null,revocation_reason:null,current:index===0,version:1,
})));
