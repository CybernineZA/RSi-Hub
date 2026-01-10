export type Role = 'recruit' | 'member' | 'officer' | 'high_command' | 'commander'

export const ROLE_RANK: Record<Role, number> = {
  recruit: 0,
  member: 1,
  officer: 2,
  high_command: 3,
  commander: 4,
}

export function atLeast(role: Role, minimum: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}
