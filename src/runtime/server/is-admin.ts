import useFetcher from './useFetcher'

const CONTENT_ADMIN_ROLE = 'ROLE_CMS_ADMIN'

export const ADMIN_TOKEN_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', CONTENT_ADMIN_ROLE]

export async function isAdmin(cookie: string | undefined, timeout: number) {
  if (!cookie) {
    return false
  }
  const { fetcher } = useFetcher()
  try {
    const user = await fetcher<{ roles?: unknown }>('/me', { headers: { cookie }, timeout })
    return Array.isArray(user?.roles) && user.roles.includes(CONTENT_ADMIN_ROLE)
  }
  catch {
    return false
  }
}
