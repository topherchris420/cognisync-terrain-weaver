import type { GovCloudPosture } from "./types";

export interface FedRAMPControl {
  id: string; // e.g. "AC-2", "SC-13", "AU-2"
  name: string;
  family: "Access Control" | "System and Communications" | "Audit and Accountability" | "Contingency Planning";
  status: "Compliant" | "Enforced (HSM)" | "Automated";
  description: string;
}

export const FEDRAMP_HIGH_CONTROLS: FedRAMPControl[] = [
  {
    id: "SC-13",
    name: "Cryptographic Protection",
    family: "System and Communications",
    status: "Enforced (HSM)",
    description: "FIPS 140-3 validated cryptographic modules for all spatial and telemetry payloads at rest and in transit.",
  },
  {
    id: "AC-2",
    name: "Account Management & CAC/PIV Auth",
    family: "Access Control",
    status: "Compliant",
    description: "Role-Based Access Control (RBAC) with PKI/CAC authentication enforced for emergency dispatch authority.",
  },
  {
    id: "AU-2",
    name: "Audit Events & Non-Repudiation",
    family: "Audit and Accountability",
    status: "Automated",
    description: "Zero-Trust immutable telemetry log stream replicating across isolated GovCloud US East & West regions.",
  },
  {
    id: "CP-9",
    name: "Information System Backup",
    family: "Contingency Planning",
    status: "Compliant",
    description: "Multi-region sovereign failover with continuous state snapshotting for disaster resilience.",
  },
];

export const DEFAULT_GOVCLOUD_POSTURE: GovCloudPosture = {
  environment: "AWS-GovCloud-US-East",
  compliance_tier: "FedRAMP High (JAB P-ATO)",
  fips_140_level: 3,
  encryption_at_rest: "AES-256-GCM (KMS HSM)",
  audit_logging_status: "Active (Zero-Trust Immutable Stream)",
  us_person_sovereignty: true,
  last_compliance_sync: new Date().toISOString(),
};

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  classification: "CUI // SP-EMERGENCY" | "PUBLIC RELEASE";
  checksum: string;
}

export function generateAuditEntry(
  actor: string,
  action: string,
  resource: string
): AuditLogEntry {
  const ts = new Date().toISOString();
  // Simple deterministic FIPS simulation checksum
  const raw = `${ts}-${actor}-${action}-${resource}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const checksum = `SHA256:${Math.abs(hash).toString(16).padStart(16, "0")}`;

  return {
    id: `AUDIT-${Date.now().toString(36).toUpperCase()}`,
    timestamp: ts,
    actor,
    action,
    resource,
    classification: "CUI // SP-EMERGENCY",
    checksum,
  };
}
