-- ORB Release 1 initial PostgreSQL schema. Generated from the accepted data model.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION orb_uuidv7() RETURNS uuid
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  bytes bytea := gen_random_bytes(16);
  millis bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  bytes := set_byte(bytes, 0, ((millis >> 40) & 255)::integer);
  bytes := set_byte(bytes, 1, ((millis >> 32) & 255)::integer);
  bytes := set_byte(bytes, 2, ((millis >> 24) & 255)::integer);
  bytes := set_byte(bytes, 3, ((millis >> 16) & 255)::integer);
  bytes := set_byte(bytes, 4, ((millis >> 8) & 255)::integer);
  bytes := set_byte(bytes, 5, (millis & 255)::integer);
  bytes := set_byte(bytes, 6, ((get_byte(bytes, 6) & 15) | 112));
  bytes := set_byte(bytes, 8, ((get_byte(bytes, 8) & 63) | 128));
  IF (get_byte(bytes, 6) >> 4) <> 7 THEN
    RAISE EXCEPTION 'UUIDv7 version construction failed';
  END IF;
  RETURN encode(bytes, 'hex')::uuid;
END;
$$;
CREATE TYPE "PilotRole" AS ENUM ('OWNER_ADMIN', 'OPERATIONS', 'FINANCE_VIEWER');
CREATE TYPE "ContractKind" AS ENUM ('SALES', 'PURCHASE');
CREATE TYPE "ProjectLifecycleState" AS ENUM ('DRAFT', 'ACTIVE', 'CANCELLED');
CREATE TYPE "FinancialState" AS ENUM ('OPEN', 'FINANCIALLY_CLOSED');
CREATE TYPE "ProjectFinalState" AS ENUM ('OPEN', 'FINAL_CLOSED');
CREATE TYPE "ContractVersionState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "SupplierExecutionState" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED', 'REJECTED');
CREATE TYPE "SalesExecutionState" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REJECTED');
CREATE TYPE "SalesDocumentState" AS ENUM ('MISSING', 'DRAFT', 'PENDING_APPROVAL', 'COMPLETE');
CREATE TYPE "SalesClaimState" AS ENUM ('CLEAR', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "DatasetState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "RouteTemplateCode" AS ENUM ('FOREIGN_TO_FOREIGN', 'UAE_FREE_ZONE_REEXPORT', 'UAE_IMPORT');
CREATE TYPE "RouteItemCategory" AS ENUM ('EVIDENCE', 'MILESTONE');
CREATE TYPE "RouteItemState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SATISFIED', 'NOT_APPLICABLE', 'EXCEPTION_APPROVED');
CREATE TYPE "EvidenceVerificationState" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "DocumentKind" AS ENUM ('CINV', 'PACKING_LIST');
CREATE TYPE "DocumentLanguage" AS ENUM ('AR', 'EN', 'BILINGUAL');
CREATE TYPE "GenerationState" AS ENUM ('QUEUED', 'RENDERING', 'READY', 'FAILED');
CREATE TYPE "DocumentLifecycleState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CANCELLED', 'SUPERSEDED');
CREATE TYPE "OutboundChannel" AS ENUM ('EMAIL');
CREATE TYPE "SendResult" AS ENUM ('ACCEPTED', 'DELIVERED', 'FAILED', 'UNKNOWN');
CREATE TYPE "SupplierInvoiceState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'REJECTED', 'CANCELLED');
CREATE TYPE "MoneyMovementKind" AS ENUM ('CUSTOMER_ADVANCE', 'CUSTOMER_RECEIPT', 'CUSTOMER_REFUND', 'SUPPLIER_ADVANCE', 'SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'REVERSAL');
CREATE TYPE "MoneyMovementState" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'REVERSED');
CREATE TYPE "AllocationTargetType" AS ENUM ('CINV', 'SUPPLIER_INVOICE');
CREATE TYPE "AllocationState" AS ENUM ('ACTIVE', 'REVERSED');
CREATE TYPE "DirectExpenseState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ClaimType" AS ENUM ('QUANTITY', 'WEIGHT', 'QUALITY', 'DELIVERY', 'PRICE', 'DOCUMENT');
CREATE TYPE "ClaimState" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "ClaimOutcome" AS ENUM ('RESOLVED', 'REJECTED');
CREATE TYPE "ProposalState" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'APPLIED');
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "ApprovalActionCode" AS ENUM ('CONTRACT_VERSION', 'SUPPLIER_SHIPMENT_CONFIRMATION', 'SALES_SHIPMENT_CONFIRMATION', 'TOLERANCE_EXCEPTION', 'SUPPLIER_INVOICE_CONFIRMATION', 'DIRECT_EXPENSE', 'EXPENSE_CORRECTION', 'DOCUMENT_OUTPUT', 'EXTERNAL_SEND', 'CLAIM_OUTCOME', 'CLOSURE_EXCEPTION', 'FINAL_CLOSE', 'REOPEN');
CREATE TYPE "RestoreState" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED');
CREATE TABLE "User" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  auth_subject text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  locale text NOT NULL,
  status text NOT NULL,
  mfa_state text NOT NULL,
  created_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamptz(6) NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "UserRole" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL,
  role "PilotRole" NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (user_id, role)
);
CREATE TABLE "Session" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL,
  expires_at timestamptz(6) NOT NULL,
  mfa_satisfied_at timestamptz(6),
  revoked_at timestamptz(6),
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "PilotSession" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_seen_at timestamptz(6) NOT NULL,
  idle_expires_at timestamptz(6) NOT NULL,
  absolute_expires_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  revoked_by uuid,
  revocation_reason text,
  current boolean DEFAULT FALSE NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL))
);
CREATE TABLE "Party" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  legal_name_ar text NOT NULL,
  legal_name_en text NOT NULL,
  country_code char(2) NOT NULL,
  customer boolean DEFAULT FALSE NOT NULL,
  supplier boolean DEFAULT FALSE NOT NULL,
  sensitive_identity_ciphertext text,
  status text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (reference)
);
CREATE TABLE "CoffeeSpecification" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  origin text NOT NULL,
  type text NOT NULL,
  grade text NOT NULL,
  crop_year text NOT NULL,
  bag_type text NOT NULL,
  standard_bag_weight numeric(20,6) NOT NULL,
  attributes jsonb NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (reference)
);
CREATE TABLE "Currency" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  code char(3) NOT NULL UNIQUE,
  decimals integer NOT NULL,
  active boolean DEFAULT TRUE NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "ExpenseCategory" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  active boolean DEFAULT TRUE NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "Project" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  customer_id uuid NOT NULL,
  primary_sales_contract_id uuid,
  lifecycle_state "ProjectLifecycleState" DEFAULT 'DRAFT' NOT NULL,
  financial_state "FinancialState" DEFAULT 'OPEN' NOT NULL,
  final_state "ProjectFinalState" DEFAULT 'OPEN' NOT NULL,
  management_currency char(3) NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (reference)
);
CREATE TABLE "Contract" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  kind "ContractKind" NOT NULL,
  reference text NOT NULL,
  counterparty_id uuid NOT NULL,
  active_version_id uuid,
  state text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (project_id, reference),
  UNIQUE (id, project_id)
);
CREATE TABLE "ContractVersion" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  contract_id uuid NOT NULL,
  revision_no integer NOT NULL,
  effective_date date NOT NULL,
  amendment_reason text,
  coffee_specification_id uuid NOT NULL,
  quantity numeric(20,6) NOT NULL,
  unit_price numeric(20,6) NOT NULL,
  currency char(3) NOT NULL,
  route "RouteTemplateCode" NOT NULL,
  incoterm text NOT NULL,
  named_place text NOT NULL,
  quantity_tolerance_under numeric DEFAULT 0 NOT NULL,
  quantity_tolerance_over numeric DEFAULT 0 NOT NULL,
  net_weight_tolerance_under numeric DEFAULT 0 NOT NULL,
  net_weight_tolerance_over numeric DEFAULT 0 NOT NULL,
  gross_weight_tolerance_under numeric DEFAULT 0 NOT NULL,
  gross_weight_tolerance_over numeric DEFAULT 0 NOT NULL,
  payment_terms text NOT NULL,
  document_terms text NOT NULL,
  state "ContractVersionState" DEFAULT 'DRAFT' NOT NULL,
  approval_id uuid,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (contract_id, revision_no),
  CHECK (quantity_tolerance_under >= 0 AND quantity_tolerance_over >= 0 AND net_weight_tolerance_under >= 0 AND net_weight_tolerance_over >= 0 AND gross_weight_tolerance_under >= 0 AND gross_weight_tolerance_over >= 0)
);
CREATE TABLE "SupplierShipment" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  purchase_contract_id uuid NOT NULL,
  reference text NOT NULL,
  active_dataset_id uuid,
  execution_state "SupplierExecutionState" DEFAULT 'DRAFT' NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (project_id, reference),
  UNIQUE (id, project_id)
);
CREATE TABLE "SupplierShipmentDataset" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  shipment_id uuid NOT NULL,
  revision_no integer NOT NULL,
  dataset_version integer NOT NULL,
  dataset_hash char(64) NOT NULL,
  purchase_contract_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  coffee_specification_id uuid NOT NULL,
  supplier_lot_reference text NOT NULL,
  quantity numeric(20,6) NOT NULL,
  bag_count integer NOT NULL,
  bag_weight numeric(20,6) NOT NULL,
  net_weight numeric(20,6) NOT NULL,
  gross_weight numeric(20,6) NOT NULL,
  origin_country char(2) NOT NULL,
  origin_location text NOT NULL,
  load_location text NOT NULL,
  discharge_location text,
  destination_country char(2) NOT NULL,
  destination_location text NOT NULL,
  incoterm text NOT NULL,
  named_place text NOT NULL,
  container_numbers text[] NOT NULL,
  seal_numbers text[] NOT NULL,
  transport_mode text NOT NULL,
  carrier text NOT NULL,
  transport_reference text NOT NULL,
  vessel_or_vehicle text,
  voyage_or_trip text,
  estimated_departure timestamptz(6),
  estimated_arrival timestamptz(6),
  planned_shipment_at timestamptz(6),
  notes text,
  state "DatasetState" DEFAULT 'DRAFT' NOT NULL,
  approval_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  revision_reason text NOT NULL,
  invalidated_approval_ids uuid[] NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (shipment_id, revision_no)
);
CREATE TABLE "SalesShipment" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  sales_contract_id uuid NOT NULL,
  reference text NOT NULL,
  primary_supplier_shipment_id uuid,
  active_dataset_id uuid,
  execution_state "SalesExecutionState" DEFAULT 'DRAFT' NOT NULL,
  financial_state "FinancialState" DEFAULT 'OPEN' NOT NULL,
  document_state "SalesDocumentState" DEFAULT 'MISSING' NOT NULL,
  claim_state "SalesClaimState" DEFAULT 'CLEAR' NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (project_id, reference),
  UNIQUE (id, project_id),
  CHECK (execution_state NOT IN ('CONFIRMED','IN_TRANSIT','DELIVERED') OR primary_supplier_shipment_id IS NOT NULL)
);
CREATE TABLE "SalesShipmentDataset" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  shipment_id uuid NOT NULL,
  revision_no integer NOT NULL,
  dataset_version integer NOT NULL,
  dataset_hash char(64) NOT NULL,
  sales_contract_id uuid NOT NULL,
  coffee_specification_id uuid NOT NULL,
  product_description text NOT NULL,
  customer_purchase_order_reference text,
  marks_and_numbers text,
  quantity numeric(20,6) NOT NULL,
  bag_count integer NOT NULL,
  bag_weight numeric(20,6) NOT NULL,
  net_weight numeric(20,6) NOT NULL,
  gross_weight numeric(20,6) NOT NULL,
  origin_country char(2) NOT NULL,
  origin_location text NOT NULL,
  load_location text NOT NULL,
  discharge_location text NOT NULL,
  destination_country char(2) NOT NULL,
  destination_location text NOT NULL,
  incoterm text NOT NULL,
  named_place text NOT NULL,
  container_numbers text[] NOT NULL,
  seal_numbers text[] NOT NULL,
  transport_mode text NOT NULL,
  carrier text NOT NULL,
  transport_reference text NOT NULL,
  vessel_or_vehicle text,
  voyage_or_trip text,
  estimated_departure timestamptz(6),
  estimated_arrival timestamptz(6),
  planned_shipment_at timestamptz(6),
  notes text,
  state "DatasetState" DEFAULT 'DRAFT' NOT NULL,
  approval_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  revision_reason text NOT NULL,
  invalidated_approval_ids uuid[] NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (shipment_id, revision_no)
);
CREATE TABLE "ShipmentExecutionEvent" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  shipment_type text NOT NULL,
  shipment_id uuid NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  dataset_id uuid NOT NULL,
  occurred_at timestamptz(6) NOT NULL,
  reason text,
  evidence_id uuid,
  actor_id uuid NOT NULL,
  aggregate_version integer NOT NULL,
  idempotency_key text NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "RouteChecklist" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  sales_shipment_id uuid NOT NULL UNIQUE,
  template_code "RouteTemplateCode" NOT NULL,
  template_version integer NOT NULL,
  snapshot_hash char(64) NOT NULL,
  status text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "RouteChecklistItem" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  checklist_id uuid NOT NULL,
  code text NOT NULL,
  category "RouteItemCategory" NOT NULL,
  required boolean NOT NULL,
  closure_blocking boolean NOT NULL,
  state "RouteItemState" DEFAULT 'NOT_STARTED' NOT NULL,
  evidence_id uuid,
  milestone_at timestamptz(6),
  completed_by uuid,
  completed_at timestamptz(6),
  exception_approval_id uuid,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (checklist_id, code)
);
CREATE TABLE "EvidenceObject" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  sha256 char(64) NOT NULL,
  byte_length bigint NOT NULL,
  media_type text NOT NULL,
  object_key text NOT NULL,
  object_version_id text NOT NULL,
  original_filename text NOT NULL,
  verification_state "EvidenceVerificationState" DEFAULT 'PENDING' NOT NULL,
  verified_by uuid,
  verified_at timestamptz(6),
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  retention_until timestamptz(6) NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  CHECK ((verification_state = 'PENDING' AND verified_at IS NULL AND verified_by IS NULL) OR (verification_state = 'VERIFIED' AND verified_at IS NOT NULL AND verified_by IS NOT NULL) OR verification_state = 'REJECTED'),
  UNIQUE (object_key, object_version_id)
);
CREATE TABLE "EvidenceLink" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  evidence_id uuid NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  purpose text NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (evidence_id, subject_type, subject_id, purpose)
);
CREATE TABLE "CommercialDocument" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  sales_shipment_id uuid NOT NULL,
  kind "DocumentKind" NOT NULL,
  reference text NOT NULL,
  active_revision_id uuid,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (project_id, reference)
);
CREATE TABLE "DocumentRevision" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  document_id uuid NOT NULL,
  revision_no integer NOT NULL,
  source_sales_shipment_dataset_id uuid NOT NULL,
  language "DocumentLanguage" NOT NULL,
  generation_state "GenerationState" DEFAULT 'QUEUED' NOT NULL,
  lifecycle_state "DocumentLifecycleState" DEFAULT 'DRAFT' NOT NULL,
  evidence_id uuid,
  sha256 char(64),
  reason text,
  approval_id uuid,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (document_id, revision_no)
);
CREATE TABLE "OutboundManifest" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  supersedes_manifest_id uuid,
  document_revision_id uuid NOT NULL,
  document_revision_version integer NOT NULL,
  output_sha256 char(64) NOT NULL,
  channel "OutboundChannel" DEFAULT 'EMAIL' NOT NULL,
  ordered_to_recipients jsonb NOT NULL,
  ordered_cc_recipients jsonb NOT NULL,
  attachment_manifest jsonb NOT NULL,
  subject text NOT NULL,
  body_media_type text NOT NULL,
  body_bytes_object_key text NOT NULL,
  body_byte_length bigint NOT NULL,
  body_sha256 char(64) NOT NULL,
  manifest_hash char(64) NOT NULL,
  state "DocumentLifecycleState" DEFAULT 'DRAFT' NOT NULL,
  approval_id uuid,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "OutboundSendAttempt" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  manifest_id uuid NOT NULL,
  manifest_version integer NOT NULL,
  manifest_hash char(64) NOT NULL,
  approval_id uuid NOT NULL,
  attempt_no integer NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz(6) NOT NULL,
  completed_at timestamptz(6),
  result "SendResult" NOT NULL,
  provider_reference text,
  failure_code text,
  correlation_id uuid NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (manifest_id, attempt_no)
);
CREATE TABLE "SupplierInvoice" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  supplier_shipment_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  reference text NOT NULL,
  invoice_date date NOT NULL,
  amount numeric(20,6) NOT NULL,
  currency char(3) NOT NULL,
  evidence_id uuid NOT NULL,
  state "SupplierInvoiceState" DEFAULT 'DRAFT' NOT NULL,
  approval_id uuid,
  cancellation_reason text,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (supplier_id, reference)
);
CREATE TABLE "MoneyMovement" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  party_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  kind "MoneyMovementKind" NOT NULL,
  direction text NOT NULL,
  amount numeric(20,6) NOT NULL,
  currency char(3) NOT NULL,
  occurred_on date NOT NULL,
  reference text NOT NULL,
  evidence_id uuid,
  state "MoneyMovementState" DEFAULT 'DRAFT' NOT NULL,
  aed_amount numeric(20,6),
  fx_rate numeric(20,10),
  fx_date date,
  fx_source text,
  reversal_of_id uuid,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (project_id, reference),
  CHECK ((aed_amount IS NULL AND fx_rate IS NULL AND fx_date IS NULL AND fx_source IS NULL) OR (aed_amount IS NOT NULL AND fx_rate IS NOT NULL AND fx_date IS NOT NULL AND fx_source IS NOT NULL))
);
CREATE TABLE "SettlementAllocation" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  movement_id uuid NOT NULL,
  target_type "AllocationTargetType" NOT NULL,
  target_id uuid NOT NULL,
  amount numeric(20,6) NOT NULL,
  currency char(3) NOT NULL,
  state "AllocationState" DEFAULT 'ACTIVE' NOT NULL,
  allocated_by uuid NOT NULL,
  allocated_at timestamptz(6) NOT NULL,
  reversal_of_id uuid UNIQUE,
  reversal_reason text,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  CHECK ((state <> 'REVERSED') OR (reversal_of_id IS NOT NULL AND reversal_reason IS NOT NULL))
);
CREATE TABLE "DirectExpense" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  sales_shipment_id uuid,
  vendor_id uuid NOT NULL,
  category_code text NOT NULL,
  amount numeric(20,6) NOT NULL,
  currency char(3) NOT NULL,
  occurred_on date NOT NULL,
  evidence_id uuid NOT NULL,
  state "DirectExpenseState" DEFAULT 'DRAFT' NOT NULL,
  approval_id uuid,
  replaces_expense_id uuid,
  replaced_by_expense_id uuid,
  cancellation_reason text,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  CHECK (sales_shipment_id IS NULL OR project_id IS NOT NULL)
);
CREATE TABLE "ExpenseCorrection" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  original_expense_id uuid NOT NULL,
  replacement_expense_id uuid NOT NULL,
  reason text NOT NULL,
  subject_hash char(64) NOT NULL,
  approval_id uuid NOT NULL,
  applied_at timestamptz(6),
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (original_expense_id, replacement_expense_id)
);
CREATE TABLE "Claim" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  sales_shipment_id uuid,
  supplier_shipment_id uuid,
  type "ClaimType" NOT NULL,
  claimant_id uuid NOT NULL,
  respondent_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric(20,6),
  amount numeric(20,6),
  currency char(3),
  state "ClaimState" DEFAULT 'OPEN' NOT NULL,
  evidence_id uuid,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  CHECK (num_nonnulls(sales_shipment_id, supplier_shipment_id) <= 1)
);
CREATE TABLE "ClaimOutcomeProposal" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  claim_id uuid NOT NULL,
  claim_version integer NOT NULL,
  proposed_outcome "ClaimOutcome" NOT NULL,
  reason text NOT NULL,
  evidence_id uuid,
  subject_hash char(64) NOT NULL,
  state "ProposalState" DEFAULT 'PENDING_APPROVAL' NOT NULL,
  approval_id uuid,
  applied_at timestamptz(6),
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "Approval" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  action_code "ApprovalActionCode" NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  subject_version integer NOT NULL,
  subject_hash char(64) NOT NULL,
  requester_id uuid NOT NULL,
  decision "ApprovalDecision" DEFAULT 'PENDING' NOT NULL,
  approver_id uuid,
  decided_at timestamptz(6),
  reason text,
  comment text,
  evidence_id uuid,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  CHECK (approver_id IS NULL OR requester_id <> approver_id)
);
CREATE TABLE "ProfitSnapshot" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  project_version integer NOT NULL,
  as_of timestamptz(6) NOT NULL,
  currency char(3) NOT NULL,
  expected_margin numeric(20,6) NOT NULL,
  committed_margin numeric(20,6) NOT NULL,
  actual_operational_margin numeric(20,6) NOT NULL,
  cash_position numeric(20,6) NOT NULL,
  formula_version text NOT NULL,
  input_hash char(64) NOT NULL,
  generated_at timestamptz(6) NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "ProfitLine" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  snapshot_id uuid NOT NULL,
  measure text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  amount numeric(20,6) NOT NULL,
  currency char(3) NOT NULL,
  explanation text NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "ClosureAssessment" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  project_version integer NOT NULL,
  assessed_at timestamptz(6) NOT NULL,
  quantity_delivery_complete boolean NOT NULL,
  route_complete boolean NOT NULL,
  documents_complete boolean NOT NULL,
  supplier_obligations_complete boolean NOT NULL,
  expenses_complete boolean NOT NULL,
  claims_complete boolean NOT NULL,
  approvals_complete boolean NOT NULL,
  blockers_hash char(64) NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "ClosureBlocker" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  assessment_id uuid NOT NULL,
  code text NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  message_key text NOT NULL,
  exception_eligible boolean NOT NULL,
  covered_by_approval_id uuid,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "BackupSnapshot" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  database_backup_id text NOT NULL,
  object_snapshot_id text NOT NULL,
  completed_at timestamptz(6) NOT NULL,
  encrypted boolean NOT NULL,
  separate_copy boolean NOT NULL,
  rpo_minutes integer NOT NULL,
  manifest_hash char(64) NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "RestoreTest" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  backup_snapshot_id uuid NOT NULL,
  isolated_environment text NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz(6) NOT NULL,
  state "RestoreState" DEFAULT 'QUEUED' NOT NULL,
  completed_at timestamptz(6),
  rpo_minutes integer,
  rto_minutes integer,
  evidence_id uuid,
  version integer DEFAULT 1 NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7)
);
CREATE TABLE "AuditEvent" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  project_id uuid NOT NULL,
  sequence_no bigint NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version integer NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  actor_snapshot jsonb NOT NULL,
  session_id uuid NOT NULL,
  occurred_at timestamptz(6) NOT NULL,
  reason text,
  correlation_id uuid NOT NULL,
  idempotency_key text,
  before_hash char(64),
  after_hash char(64) NOT NULL,
  previous_event_hash char(64),
  event_hash char(64) NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (project_id, sequence_no)
);
CREATE TABLE "IdempotencyRecord" (
  id uuid DEFAULT orb_uuidv7() NOT NULL PRIMARY KEY,
  actor_id uuid NOT NULL,
  operation_id text NOT NULL,
  key text NOT NULL,
  request_hash char(64) NOT NULL,
  response_status integer NOT NULL,
  response_locator text,
  response_hash char(64) NOT NULL,
  created_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at timestamptz(6) NOT NULL,
  CHECK ((get_byte(uuid_send(id), 6) >> 4) = 7),
  UNIQUE (actor_id, operation_id, key)
);
ALTER TABLE "UserRole" ADD CONSTRAINT "fk_1_UserRole" FOREIGN KEY (user_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Session" ADD CONSTRAINT "fk_2_Session" FOREIGN KEY (user_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "PilotSession" ADD CONSTRAINT "fk_3_PilotSession" FOREIGN KEY (user_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "PilotSession" ADD CONSTRAINT "fk_4_PilotSession" FOREIGN KEY (revoked_by) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Project" ADD CONSTRAINT "fk_5_Project" FOREIGN KEY (customer_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Contract" ADD CONSTRAINT "fk_6_Contract" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Contract" ADD CONSTRAINT "fk_7_Contract" FOREIGN KEY (counterparty_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ContractVersion" ADD CONSTRAINT "fk_8_ContractVersion" FOREIGN KEY (contract_id) REFERENCES "Contract" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ContractVersion" ADD CONSTRAINT "fk_9_ContractVersion" FOREIGN KEY (coffee_specification_id) REFERENCES "CoffeeSpecification" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipment" ADD CONSTRAINT "fk_10_SupplierShipment" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipment" ADD CONSTRAINT "fk_11_SupplierShipment" FOREIGN KEY (purchase_contract_id) REFERENCES "Contract" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "fk_12_SupplierShipmentDataset" FOREIGN KEY (shipment_id) REFERENCES "SupplierShipment" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "fk_13_SupplierShipmentDataset" FOREIGN KEY (purchase_contract_id) REFERENCES "Contract" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "fk_14_SupplierShipmentDataset" FOREIGN KEY (supplier_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "fk_15_SupplierShipmentDataset" FOREIGN KEY (coffee_specification_id) REFERENCES "CoffeeSpecification" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipment" ADD CONSTRAINT "fk_16_SalesShipment" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipment" ADD CONSTRAINT "fk_17_SalesShipment" FOREIGN KEY (sales_contract_id) REFERENCES "Contract" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipment" ADD CONSTRAINT "fk_18_SalesShipment" FOREIGN KEY (primary_supplier_shipment_id, project_id) REFERENCES "SupplierShipment" (id, project_id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipmentDataset" ADD CONSTRAINT "fk_19_SalesShipmentDataset" FOREIGN KEY (shipment_id) REFERENCES "SalesShipment" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipmentDataset" ADD CONSTRAINT "fk_20_SalesShipmentDataset" FOREIGN KEY (sales_contract_id) REFERENCES "Contract" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipmentDataset" ADD CONSTRAINT "fk_21_SalesShipmentDataset" FOREIGN KEY (coffee_specification_id) REFERENCES "CoffeeSpecification" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RouteChecklist" ADD CONSTRAINT "fk_22_RouteChecklist" FOREIGN KEY (sales_shipment_id) REFERENCES "SalesShipment" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RouteChecklistItem" ADD CONSTRAINT "fk_23_RouteChecklistItem" FOREIGN KEY (checklist_id) REFERENCES "RouteChecklist" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "fk_24_EvidenceLink" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "CommercialDocument" ADD CONSTRAINT "fk_25_CommercialDocument" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "CommercialDocument" ADD CONSTRAINT "fk_26_CommercialDocument" FOREIGN KEY (sales_shipment_id) REFERENCES "SalesShipment" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "fk_27_DocumentRevision" FOREIGN KEY (document_id) REFERENCES "CommercialDocument" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "fk_28_DocumentRevision" FOREIGN KEY (source_sales_shipment_dataset_id) REFERENCES "SalesShipmentDataset" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "fk_29_DocumentRevision" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "OutboundManifest" ADD CONSTRAINT "fk_30_OutboundManifest" FOREIGN KEY (document_revision_id) REFERENCES "DocumentRevision" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "OutboundSendAttempt" ADD CONSTRAINT "fk_31_OutboundSendAttempt" FOREIGN KEY (manifest_id) REFERENCES "OutboundManifest" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "fk_32_SupplierInvoice" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "fk_33_SupplierInvoice" FOREIGN KEY (supplier_shipment_id) REFERENCES "SupplierShipment" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "fk_34_SupplierInvoice" FOREIGN KEY (supplier_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "fk_35_SupplierInvoice" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "fk_36_MoneyMovement" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "fk_37_MoneyMovement" FOREIGN KEY (party_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "fk_38_MoneyMovement" FOREIGN KEY (contract_id) REFERENCES "Contract" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "fk_39_SettlementAllocation" FOREIGN KEY (movement_id) REFERENCES "MoneyMovement" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_40_DirectExpense" FOREIGN KEY (sales_shipment_id, project_id) REFERENCES "SalesShipment" (id, project_id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_41_DirectExpense" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_42_DirectExpense" FOREIGN KEY (vendor_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_43_DirectExpense" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ExpenseCorrection" ADD CONSTRAINT "fk_44_ExpenseCorrection" FOREIGN KEY (original_expense_id) REFERENCES "DirectExpense" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ExpenseCorrection" ADD CONSTRAINT "fk_45_ExpenseCorrection" FOREIGN KEY (replacement_expense_id) REFERENCES "DirectExpense" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Claim" ADD CONSTRAINT "fk_46_Claim" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Claim" ADD CONSTRAINT "fk_47_Claim" FOREIGN KEY (sales_shipment_id, project_id) REFERENCES "SalesShipment" (id, project_id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Claim" ADD CONSTRAINT "fk_48_Claim" FOREIGN KEY (supplier_shipment_id, project_id) REFERENCES "SupplierShipment" (id, project_id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Claim" ADD CONSTRAINT "fk_49_Claim" FOREIGN KEY (claimant_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Claim" ADD CONSTRAINT "fk_50_Claim" FOREIGN KEY (respondent_id) REFERENCES "Party" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ClaimOutcomeProposal" ADD CONSTRAINT "fk_51_ClaimOutcomeProposal" FOREIGN KEY (claim_id) REFERENCES "Claim" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Approval" ADD CONSTRAINT "fk_52_Approval" FOREIGN KEY (requester_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Approval" ADD CONSTRAINT "fk_53_Approval" FOREIGN KEY (approver_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ProfitSnapshot" ADD CONSTRAINT "fk_54_ProfitSnapshot" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ProfitLine" ADD CONSTRAINT "fk_55_ProfitLine" FOREIGN KEY (snapshot_id) REFERENCES "ProfitSnapshot" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ClosureAssessment" ADD CONSTRAINT "fk_56_ClosureAssessment" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ClosureBlocker" ADD CONSTRAINT "fk_57_ClosureBlocker" FOREIGN KEY (assessment_id) REFERENCES "ClosureAssessment" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RestoreTest" ADD CONSTRAINT "fk_58_RestoreTest" FOREIGN KEY (backup_snapshot_id) REFERENCES "BackupSnapshot" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "fk_59_AuditEvent" FOREIGN KEY (project_id) REFERENCES "Project" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "fk_60_AuditEvent" FOREIGN KEY (actor_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "fk_61_AuditEvent" FOREIGN KEY (session_id) REFERENCES "PilotSession" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "fk_62_IdempotencyRecord" FOREIGN KEY (actor_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Project" ADD CONSTRAINT "fk_100_Project" FOREIGN KEY (primary_sales_contract_id) REFERENCES "Contract" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Contract" ADD CONSTRAINT "fk_101_Contract" FOREIGN KEY (active_version_id) REFERENCES "ContractVersion" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ContractVersion" ADD CONSTRAINT "fk_102_ContractVersion" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipment" ADD CONSTRAINT "fk_103_SupplierShipment" FOREIGN KEY (active_dataset_id) REFERENCES "SupplierShipmentDataset" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "fk_104_SupplierShipmentDataset" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "fk_105_SupplierShipmentDataset" FOREIGN KEY (created_by) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipment" ADD CONSTRAINT "fk_106_SalesShipment" FOREIGN KEY (active_dataset_id) REFERENCES "SalesShipmentDataset" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipmentDataset" ADD CONSTRAINT "fk_107_SalesShipmentDataset" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SalesShipmentDataset" ADD CONSTRAINT "fk_108_SalesShipmentDataset" FOREIGN KEY (created_by) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ShipmentExecutionEvent" ADD CONSTRAINT "fk_109_ShipmentExecutionEvent" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ShipmentExecutionEvent" ADD CONSTRAINT "fk_110_ShipmentExecutionEvent" FOREIGN KEY (actor_id) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RouteChecklistItem" ADD CONSTRAINT "fk_111_RouteChecklistItem" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RouteChecklistItem" ADD CONSTRAINT "fk_112_RouteChecklistItem" FOREIGN KEY (completed_by) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RouteChecklistItem" ADD CONSTRAINT "fk_113_RouteChecklistItem" FOREIGN KEY (exception_approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "CommercialDocument" ADD CONSTRAINT "fk_114_CommercialDocument" FOREIGN KEY (active_revision_id) REFERENCES "DocumentRevision" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "fk_115_DocumentRevision" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "OutboundManifest" ADD CONSTRAINT "fk_116_OutboundManifest" FOREIGN KEY (supersedes_manifest_id) REFERENCES "OutboundManifest" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "OutboundManifest" ADD CONSTRAINT "fk_117_OutboundManifest" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "OutboundSendAttempt" ADD CONSTRAINT "fk_118_OutboundSendAttempt" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "OutboundSendAttempt" ADD CONSTRAINT "fk_119_OutboundSendAttempt" FOREIGN KEY (requested_by) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "fk_120_SupplierInvoice" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "fk_121_MoneyMovement" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "fk_122_MoneyMovement" FOREIGN KEY (reversal_of_id) REFERENCES "MoneyMovement" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "fk_123_SettlementAllocation" FOREIGN KEY (allocated_by) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "fk_124_SettlementAllocation" FOREIGN KEY (reversal_of_id) REFERENCES "SettlementAllocation" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_125_DirectExpense" FOREIGN KEY (category_code) REFERENCES "ExpenseCategory" (code) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_126_DirectExpense" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_127_DirectExpense" FOREIGN KEY (replaces_expense_id) REFERENCES "DirectExpense" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "fk_128_DirectExpense" FOREIGN KEY (replaced_by_expense_id) REFERENCES "DirectExpense" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ExpenseCorrection" ADD CONSTRAINT "fk_129_ExpenseCorrection" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Claim" ADD CONSTRAINT "fk_130_Claim" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ClaimOutcomeProposal" ADD CONSTRAINT "fk_131_ClaimOutcomeProposal" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ClaimOutcomeProposal" ADD CONSTRAINT "fk_132_ClaimOutcomeProposal" FOREIGN KEY (approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Approval" ADD CONSTRAINT "fk_133_Approval" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ClosureBlocker" ADD CONSTRAINT "fk_135_ClosureBlocker" FOREIGN KEY (covered_by_approval_id) REFERENCES "Approval" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RestoreTest" ADD CONSTRAINT "fk_136_RestoreTest" FOREIGN KEY (evidence_id) REFERENCES "EvidenceObject" (id) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "RestoreTest" ADD CONSTRAINT "fk_137_RestoreTest" FOREIGN KEY (requested_by) REFERENCES "User" (id) DEFERRABLE INITIALLY IMMEDIATE;
CREATE UNIQUE INDEX one_sales_contract_per_project ON "Contract" (project_id) WHERE kind = 'SALES';
CREATE OR REPLACE FUNCTION orb_deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'immutable ORB record: %', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;
CREATE OR REPLACE FUNCTION orb_guard_immutable_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_content jsonb := to_jsonb(OLD);
  new_content jsonb := to_jsonb(NEW);
  allowed_column text;
BEGIN
  FOREACH allowed_column IN ARRAY TG_ARGV LOOP
    old_content := old_content - allowed_column;
    new_content := new_content - allowed_column;
  END LOOP;
  IF old_content IS DISTINCT FROM new_content THEN
    RAISE EXCEPTION 'immutable ORB content: %', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ShipmentExecutionEvent_append_only" BEFORE UPDATE OR DELETE ON "ShipmentExecutionEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
CREATE TRIGGER "OutboundSendAttempt_append_only" BEFORE UPDATE OR DELETE ON "OutboundSendAttempt" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
CREATE TRIGGER "ContractVersion_immutable_content" BEFORE UPDATE ON "ContractVersion" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('state', 'approval_id');
CREATE TRIGGER "SupplierShipmentDataset_immutable_content" BEFORE UPDATE ON "SupplierShipmentDataset" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('state', 'approval_id', 'invalidated_approval_ids');
CREATE TRIGGER "SalesShipmentDataset_immutable_content" BEFORE UPDATE ON "SalesShipmentDataset" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('state', 'approval_id', 'invalidated_approval_ids');
CREATE TRIGGER "EvidenceObject_immutable_content" BEFORE UPDATE ON "EvidenceObject" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('verification_state', 'verified_by', 'verified_at');
CREATE TRIGGER "DocumentRevision_immutable_content" BEFORE UPDATE ON "DocumentRevision" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('generation_state', 'lifecycle_state', 'evidence_id', 'sha256', 'reason', 'approval_id', 'version');
CREATE TRIGGER "OutboundManifest_immutable_content" BEFORE UPDATE ON "OutboundManifest" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('state', 'approval_id', 'version');
CREATE TRIGGER "ClaimOutcomeProposal_immutable_content" BEFORE UPDATE ON "ClaimOutcomeProposal" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('state', 'approval_id', 'applied_at');
CREATE TRIGGER "Approval_immutable_content" BEFORE UPDATE ON "Approval" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('decision', 'approver_id', 'decided_at', 'reason', 'comment', 'evidence_id');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orb_app') THEN
    REVOKE UPDATE, DELETE ON "ShipmentExecutionEvent", "OutboundSendAttempt", "AuditEvent" FROM orb_app;
  END IF;
END;
$$;
