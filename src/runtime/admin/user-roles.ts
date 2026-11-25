export interface UserRoleLevel {
  value: string
  label: string
  description?: string
  roles: string[]
  reachesExtensionRoles: boolean
}

export const userRoleLevels: UserRoleLevel[] = [
  { value: 'user', label: 'User', roles: ['ROLE_USER'], reachesExtensionRoles: false },
  { value: 'content', label: 'Content admin', description: 'Edits content', roles: ['ROLE_CMS_ADMIN'], reachesExtensionRoles: false },
  { value: 'users', label: 'User admin', description: 'Manages users', roles: ['ROLE_USER_ADMIN'], reachesExtensionRoles: false },
  { value: 'content-users', label: 'Content and user admin', description: 'Edits content and manages users', roles: ['ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN'], reachesExtensionRoles: false },
  { value: 'admin', label: 'Admin', description: 'Content and extensions', roles: ['ROLE_ADMIN'], reachesExtensionRoles: true },
  { value: 'admin-users', label: 'Admin and user admin', description: 'Content, extensions and users', roles: ['ROLE_ADMIN', 'ROLE_USER_ADMIN'], reachesExtensionRoles: true },
  { value: 'super', label: 'Super admin', description: 'Everything', roles: ['ROLE_SUPER_ADMIN'], reachesExtensionRoles: true },
]

export function userRoleLevel(reached: unknown): UserRoleLevel {
  const roles = Array.isArray(reached) ? reached : []
  const has = (role: string) => roles.includes(role)
  const value = has('ROLE_SUPER_ADMIN')
    ? 'super'
    : has('ROLE_ADMIN')
      ? (has('ROLE_USER_ADMIN') ? 'admin-users' : 'admin')
      : has('ROLE_CMS_ADMIN')
        ? (has('ROLE_USER_ADMIN') ? 'content-users' : 'content')
        : has('ROLE_USER_ADMIN') ? 'users' : 'user'
  return userRoleLevels.find(level => level.value === value)!
}

export function rolesForLevel(level: UserRoleLevel, extensionRoles: string[]) {
  return level.reachesExtensionRoles ? [...level.roles] : [...level.roles, ...extensionRoles]
}
