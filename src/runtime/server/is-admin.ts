import useFetcher from './useFetcher'

export const ADMIN_ROLES = ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN']

export async function isAdmin(cookie: string | undefined, timeout: number) {
  if (!cookie) {
    return false
  }
  const { fetcher } = useFetcher()
  try {
    const user = await fetcher<{ roles?: unknown }>('/me', { headers: { cookie }, timeout })
    return Array.isArray(user?.roles) && user.roles.some(role => ADMIN_ROLES.includes(role))
  }
  catch {
    return false
  }
}
