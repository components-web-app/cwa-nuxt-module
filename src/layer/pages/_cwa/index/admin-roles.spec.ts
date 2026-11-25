// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { useRouter } from '#app/composables/router'

describe('admin pages ask for the role that manages them (bundle #611)', () => {
  test.each([
    ['_cwa-users-user', {}],
    ['_cwa-users-user-iri', { iri: '/_/users/1' }],
  ])('%s is for user admins', (name, params) => {
    expect(useRouter().resolve({ name, params }).meta.cwaAdminRole).toBe('ROLE_USER_ADMIN')
  })

  test.each(['/_cwa/layouts', '/_cwa/pages', '/_cwa/routes', '/_cwa/settings', '/_cwa/orphaned'])('%s declares no role, so it is for content admins, the guard\'s default', (path) => {
    expect(useRouter().resolve(path).meta.cwaAdminRole).toBeUndefined()
  })
})
