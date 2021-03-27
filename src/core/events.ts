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
  component: `${prefix}:${componentManagerCategory}:component`,
  addComponent: `${prefix}:${componentManagerCategory}:add-component`,
  hide: `${prefix}:${componentManagerCategory}:hide`,
  show: `${prefix}:${componentManagerCategory}:show`
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

export default {
  API_EVENTS,
  COMPONENT_MANAGER_EVENTS,
  ADMIN_BAR_EVENTS,
  NOTIFICATION_EVENTS
}
