export const STAFF_ROLES = ["owner", "manager", "staff", "host"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const HQ_CAPABILITIES = [
  "hq.read",
  "lead.lifecycle.manage",
  "quote.approve",
  "gig.convert",
  "client.activate",
  "import.candidate.create",
  "import.review",
  "import.finalize",
  "event.operations.write",
  "event.notes.write",
  "task.write",
  "catalog.manage",
  "planning.structure.manage",
  "data.delete",
  "staff.manage",
  "system.manage",
  "schedule.read",
  "schedule.self.manage",
  "schedule.team.manage",
  "schedule.assignments.manage",
] as const;

export type HqCapability = (typeof HQ_CAPABILITIES)[number];

const OPERATIONAL_CAPABILITIES: readonly HqCapability[] = [
  "hq.read",
  "import.review",
  "event.operations.write",
  "event.notes.write",
  "task.write",
  "schedule.read",
  "schedule.self.manage",
];

const ROLE_CAPABILITIES: Record<StaffRole, ReadonlySet<HqCapability>> = {
  owner: new Set(HQ_CAPABILITIES),
  manager: new Set(OPERATIONAL_CAPABILITIES),
  staff: new Set(OPERATIONAL_CAPABILITIES),
  host: new Set(OPERATIONAL_CAPABILITIES),
};

export function staffRole(value: unknown): StaffRole | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return STAFF_ROLES.includes(normalized as StaffRole) ? normalized as StaffRole : null;
}

export function isStaffRole(value: unknown): value is StaffRole {
  return staffRole(value) !== null;
}

export function hasHqCapability(role: unknown, capability: HqCapability) {
  const normalized = staffRole(role);
  return normalized ? ROLE_CAPABILITIES[normalized].has(capability) : false;
}

export function capabilitiesForRole(role: unknown): readonly HqCapability[] {
  const normalized = staffRole(role);
  return normalized ? [...ROLE_CAPABILITIES[normalized]] : [];
}
