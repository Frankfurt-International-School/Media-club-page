export type RoleCapacitySnapshot = {
  roleCapacities: Record<string, number> | null;
};

export type EventSignupForRouting = {
  member_id: string;
  signup_role: string | null;
  role_slot: number | null;
  confirmation_status: string | null;
};

export type EventAvailabilityChange = {
  role: string;
  before: number;
  after: number;
};

export const eventRoleCapacities = (record: {
  open_signup_roles?: string[] | null;
  single_role_slot_limit?: number | null;
  photographer_slot_limit?: number | null;
}) => {
  const roles = [...new Set((Array.isArray(record.open_signup_roles) ? record.open_signup_roles : [])
    .map(role => String(role || "").trim())
    .filter(Boolean))];
  const singleRoleLimit = Math.max(1, Number(record.single_role_slot_limit) || 1);
  const photographerLimit = Math.max(1, Number(record.photographer_slot_limit) || 1);
  return Object.fromEntries(roles.map(role => [
    role,
    role === "Photographer" ? photographerLimit : roles.length === 1 ? singleRoleLimit : 1,
  ]));
};

export const eventAvailabilityChanges = (
  previous: RoleCapacitySnapshot | null,
  current: RoleCapacitySnapshot,
) => {
  if (!previous?.roleCapacities || !current.roleCapacities) {
    return { expanded: [] as EventAvailabilityChange[], reduced: [] as EventAvailabilityChange[] };
  }
  const roles = new Set([...Object.keys(previous.roleCapacities), ...Object.keys(current.roleCapacities)]);
  const expanded: EventAvailabilityChange[] = [];
  const reduced: EventAvailabilityChange[] = [];
  for (const role of roles) {
    const before = Math.max(0, Number(previous.roleCapacities[role]) || 0);
    const after = Math.max(0, Number(current.roleCapacities[role]) || 0);
    if (after > before) expanded.push({ role, before, after });
    if (after < before) reduced.push({ role, before, after });
  }
  return { expanded, reduced };
};

export const routeEventUpdateRecipients = (
  eligibleMemberIds: string[],
  signups: EventSignupForRouting[],
  previous: RoleCapacitySnapshot | null,
  current: RoleCapacitySnapshot,
) => {
  const activeSignups = signups.filter(signup => signup.confirmation_status !== "expired");
  const availability = eventAvailabilityChanges(previous, current);
  const availabilityExpanded = availability.expanded.length > 0;
  const signupMemberIds = new Set(activeSignups.map(signup => signup.member_id));
  const recipientIds = availabilityExpanded
    ? eligibleMemberIds.slice()
    : eligibleMemberIds.filter(memberId => signupMemberIds.has(memberId));
  const recipientIdSet = new Set(recipientIds);
  const reducedByRole = new Map(availability.reduced.map(change => [change.role, change.after]));
  const affectedRoleByMember: Record<string, string> = {};
  for (const signup of activeSignups) {
    const role = String(signup.signup_role || "").trim();
    if (!role || !reducedByRole.has(role) || !recipientIdSet.has(signup.member_id)) continue;
    const remainingCapacity = reducedByRole.get(role) || 0;
    const assignedSlot = Math.max(1, Number(signup.role_slot) || 1);
    if (remainingCapacity === 0 || assignedSlot > remainingCapacity) affectedRoleByMember[signup.member_id] = role;
  }
  return {
    recipientIds,
    availabilityExpanded,
    availableRoles: availability.expanded.map(change => change.role),
    affectedRoleByMember,
  };
};
