import { Vue } from 'vue/types/vue'

export interface NewComponentEvent {
  collection: string
  component(): {
    component: Promise<Vue>
  }
  endpoint: string
  name: string
}

export interface DraggableEvent {
  isDraggable: boolean
  collection?: string
}

export interface ResetStatusEvent {
  category: string
}

export interface StatusEvent extends ResetStatusEvent {
  field: string
  status: number
}

const prefix = 'cwa'

const apiCategory = 'api'
export const API_EVENTS = {
  created: `${prefix}:${apiCategory}:resource:created`,
  updated: `${prefix}:${apiCategory}:resource:updated`,
  deleted: `${prefix}:${apiCategory}:resource:deleted`,
  refreshed: `${prefix}:${apiCategory}:resource:refreshed`,
  error: `${prefix}:${apiCategory}:error`
}

const componentManagerCategory = 'component-manager'
export const COMPONENT_MANAGER_EVENTS = {
  showing: `${prefix}:${componentManagerCategory}:showing`,
  selectComponent: `${prefix}:${componentManagerCategory}:select-component`,
  addComponent: `${prefix}:${componentManagerCategory}:add-component`,
  newComponent: `${prefix}:${componentManagerCategory}:new-component`,
  hide: `${prefix}:${componentManagerCategory}:hide`,
  show: `${prefix}:${componentManagerCategory}:show`,
  showTabs: `${prefix}:${componentManagerCategory}:show-tabs`,
  tabChanged: `${prefix}:${componentManagerCategory}:tab-changed`,
  draggable: `${prefix}:${componentManagerCategory}:draggable`,
  selectPosition: `${prefix}:${componentManagerCategory}:select-position`
}

export const ADMIN_BAR_EVENTS = {
  changeView: `${prefix}:admin-bar:change-view`
}

const notificationCategory = 'notification'
export const NOTIFICATION_EVENTS = {
  add: `${prefix}:${notificationCategory}:add`,
  remove: `${prefix}:${notificationCategory}:remove`,
  clear: `${prefix}:${notificationCategory}:clear`
}

const statusCategory = 'status'
export const STATUS_EVENTS = {
  change: `${prefix}:${statusCategory}:change`,
  reset: `${prefix}:${statusCategory}:reset`
}

export default {
  API_EVENTS,
  COMPONENT_MANAGER_EVENTS,
  ADMIN_BAR_EVENTS,
  NOTIFICATION_EVENTS,
  STATUS_EVENTS
}
