import { Vue } from 'vue/types/vue'

export interface NewComponentEvent {
  collection: string
  component(): {
    component: Promise<Vue>
  }
  endpoint: string
  name: string
}
