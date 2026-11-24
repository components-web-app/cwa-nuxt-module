import type { ComputedRef } from 'vue'

export function canOpenAdminPage(auth: { isAdmin: ComputedRef<boolean>, hasRole: (role: string) => boolean }, role: string | undefined) {
  return role === undefined || role === 'ROLE_ADMIN' ? auth.isAdmin.value : auth.hasRole(role)
}
