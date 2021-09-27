import Vue from 'vue'
import type { PropType } from 'vue'
import { NotificationEvent } from '../templates/components/cwa-api-notifications/types'
import IriMixin from './IriMixin'
import ComponentManagerValueMixin from './ComponentManagerValueMixin'
import { ComponentTabContext } from './ComponentManagerMixin'

export const ComponentManagerTabMixin = Vue.extend({
  mixins: [IriMixin, ComponentManagerValueMixin],
  props: {
    context: {
      type: Object as PropType<ComponentTabContext>,
      required: false,
      default: null
    },
    fieldErrors: {
      type: Object as PropType<{
        notifications: NotificationEvent[]
        errorCount: number
      }>,
      required: false,
      default: null
    }
  },
  computed: {
    isNew() {
      return this.resource?.['@id'].endsWith('/new')
    },
    inputId() {
      return (name) => {
        return `${this.resource?.['@id'] || '__missing_id__'}-${name}`
      }
    },
    storeComponent: {
      get() {
        return this.resource
      },
      set(resource) {
        if (!this.resource?.['@id']) {
          return
        }
        this.$cwa.$storage.setResource({
          resource
        })
      }
    }
  }
})

export default ComponentManagerTabMixin
