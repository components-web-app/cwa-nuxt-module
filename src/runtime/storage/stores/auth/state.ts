import { reactive } from 'vue'
import { CwaResource } from '../../../resources/resource-utils'

export enum CwaUserRoles {
  SUPER_ADMIN = 'ROLE_SUPER_ADMIN',
  ADMIN = 'ROLE_ADMIN',
  ALLOWED_TO_SWITCH = 'ROLE_ALLOWED_TO_SWITCH',
  USER = 'ROLE_USER'
}

interface CwaUser extends CwaResource {
  emailAddress: string
  enabled: boolean
  roles: (string|CwaUserRoles)[]
  username: string
}

export interface CwaAuthStateInterface {
  data: {
    user?: CwaUser
  }
}

export default function (): CwaAuthStateInterface {
  return {
    data: reactive({
      user: undefined
    })
  }
}
