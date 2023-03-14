import { reactive } from 'vue'

export interface CwaAuthStateInterface {
  data: {
    user: any
  }
}

export default function (): CwaAuthStateInterface {
  return {
    data: reactive({
      user: null
    })
  }
}
