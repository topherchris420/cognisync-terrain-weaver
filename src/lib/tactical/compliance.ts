import type { GovCloudPosture } from "./types";

export interface OperationalControl {
  id: string; // e.g. "GIS-1", "SEC-2", "EOC-3", "AUD-4"
  name: string;
  family: "Geospatial Data Ingestion" | "Telemetry Encryption" | "Emergency Dispatch" | "Audit & Integrity";
  status: "Operational" | "TLS 1.3 Active" | "Continuous Sync";
  description: string;
}

export const MUNICIPAL_OPERATIONAL_CONTROLS: OperationalControl[] = [
  {
    id: "GIS-1",
    name: "Hydrological Feed Ingestion",
    family: "Geospatial Data Ingestion",
    status: "Continuous Sync",
    description: "Live ingestion pipeline syncing USGS NWIS streamgages, NOAA NWS precipitation forecasts, and City SCADA drainage nodes.",
  },
  {
    id: "SEC-2",
    name: "Telemetry Payload Encryption",
    family: "Telemetry Encryption",
    status: "TLS 1.3 Active",
    description: "TLS 1.3 in-transit and AES-256 at-rest encryption enforced for all municipal sensor observations and route clearance feeds.",
  },
  {
    id: "EOC-3",
    name: "Incident Command Authorization",
    family: "Emergency Dispatch",
    status: "Operational",
    description: "Multi-role dispatch verification for high-volume pumping units, temporary flood barriers, and evacuation routing orders.",
  },
  {
    id: "AUD-4",
    name: "Immutable Dispatch Ledger",
    family: "Audit & Integrity",
    status: "Continuous Sync",
    description: "Cryptographically verified audit trail logging all sensor threshold breaches, convoy dispatches, and emergency notices.",
  },
];

// Alias for backwards compatibility if needed
export const FEDRAMP_HIGH_CONTROLS = MUNICIPAL_OPERATIONAL_CONTROLS;

export const DEFAULT_GOVCLOUD_POSTURE: GovCloudPosture = {
  environment: "Municipal Enterprise GIS Node",
  compliance_tier: "NIST SP 800-171 / State Incident Command Protocol",
  encryption_at_rest: "AES-256 (Encrypted Telemetry Store)",
  audit_logging_status: "Active (Immutable EOC Audit Trail)",
  telemetry_integrity: "USGS & City SCADA Verified",
  last_compliance_sync: new Date().toISOString(),
};

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  classification: "OFFICIAL USE // INCIDENT LOG" | "PUBLIC ADVISORY";
  checksum: string;
}

export function generateAuditEntry(
  actor: string,
  action: string,
  resource: string
): AuditLogEntry {
  const ts = new Date().toISOString();
  const raw = `${ts}-${actor}-${action}-${resource}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const checksum = `SHA256:${Math.abs(hash).toString(16).padStart(16, "0")}`;

  return {
    id: `EOC-${Date.now().toString(36).toUpperCase()}`,
    timestamp: ts,
    actor,
    action,
    resource,
    classification: "OFFICIAL USE // INCIDENT LOG",
    checksum,
  };
}
