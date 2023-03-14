import { reactive } from 'vue'

export interface CwaAuthStateInterface {
  user: any
}

export default function (): CwaAuthStateInterface {
  return {
    user: reactive({})
  }
}
