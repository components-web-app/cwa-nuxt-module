import { describe, expect, test } from 'vitest'
import { userRoleLevel, userRoleLevels, rolesForLevel } from './user-roles'

const SUPER = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_ALLOWED_TO_SWITCH', 'ROLE_CMS_ADMIN', 'ROLE_USER']

describe('a user\'s level, read from every role they reach (bundle #611)', () => {
  test.each([
    [['ROLE_USER'], 'User'],
    [['ROLE_CMS_ADMIN', 'ROLE_USER'], 'Content admin'],
    [['ROLE_USER_ADMIN', 'ROLE_USER'], 'User admin'],
    [['ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_USER'], 'Content and user admin'],
    [['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER'], 'Admin'],
    [['ROLE_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER'], 'Admin and user admin'],
    [SUPER, 'Super admin'],
    [['ROLE_SHOP_ACCOUNTS', 'ROLE_USER'], 'User'],
    [undefined, 'User'],
  ])('%j is %s', (roles, label) => {
    expect(userRoleLevel(roles).label).toBe(label)
  })
})

describe('the roles a level stores', () => {
  test.each([
    ['User', ['ROLE_USER']],
    ['Content admin', ['ROLE_CMS_ADMIN']],
    ['User admin', ['ROLE_USER_ADMIN']],
    ['Content and user admin', ['ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN']],
    ['Admin', ['ROLE_ADMIN']],
    ['Admin and user admin', ['ROLE_ADMIN', 'ROLE_USER_ADMIN']],
    ['Super admin', ['ROLE_SUPER_ADMIN']],
  ])('%s stores only %j, never the roles it reaches', (label, roles) => {
    expect(rolesForLevel(userRoleLevels.find(level => level.label === label)!, [])).toEqual(roles)
  })

  test('a level below admin also stores the extension roles chosen, and an admin level none, since admins reach them', () => {
    const level = (label: string) => userRoleLevels.find(entry => entry.label === label)!
    expect(rolesForLevel(level('User'), ['ROLE_SHOP_ACCOUNTS'])).toEqual(['ROLE_USER', 'ROLE_SHOP_ACCOUNTS'])
    expect(rolesForLevel(level('Content admin'), ['ROLE_SHOP_ACCOUNTS'])).toEqual(['ROLE_CMS_ADMIN', 'ROLE_SHOP_ACCOUNTS'])
    expect(rolesForLevel(level('Admin'), ['ROLE_SHOP_ACCOUNTS'])).toEqual(['ROLE_ADMIN'])
    expect(rolesForLevel(level('Super admin'), ['ROLE_SHOP_ACCOUNTS'])).toEqual(['ROLE_SUPER_ADMIN'])
  })
})
