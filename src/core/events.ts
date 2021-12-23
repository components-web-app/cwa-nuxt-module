import { Vue } from 'vue/types/vue'
import {
  ComponentManagerComponent,
  ComponentManagerTab
} from './mixins/ComponentManagerMixin'

export interface ConfirmDialogEvent {
  id: string
  component?: Function
  componentProps?: any
  html?: string
  title?: string
  asyncData?: Function
  onSuccess?: Function
  cancelButtonText?: string
  confirmButtonText?: string
}

export interface TabChangedEvent {
  newTab: ComponentManagerTab
  previousTab: ComponentManagerTab
  context: any
}

export interface NewComponentEvent {
  collection?: string
  position?: string
  component(): {
    component: Promise<Vue>
  }
  endpoint: string
  name: string
  isPublishable: boolean
  iri: string
}

export interface ComponentManagerAddEvent {
  data?: ComponentManagerComponent
  iri: string
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

export interface PublishableToggledEvent {
  draftIri: string
  publishableIri: string
  showPublished: boolean
  publishedIri: string
}

export interface SaveStateEvent {
  iri: string
  name: string
  value: any
}

export interface ComponentCreatedEvent {
  tempIri: string
  newIri: string
}

const prefix = 'cwa'

const apiCategory = 'api'
export const API_EVENTS = {
  created: `${prefix}:${apiCategory}:resource:created`,
  updated: `${prefix}:${apiCategory}:resource:updated`,
  deleted: `${prefix}:${apiCategory}:resource:deleted`,
  refreshed: `${prefix}:${apiCategory}:resource:refreshed`,
  error: `${prefix}:${apiCategory}:error`,
  newDraft: `${prefix}:${apiCategory}:new-draft`
}

const componentManagerCategory = 'component-manager'
export const COMPONENT_MANAGER_EVENTS = {
  showing: `${prefix}:${componentManagerCategory}:showing`,
  highlightComponent: `${prefix}:${componentManagerCategory}:highlight-component`,
  publishableToggled: `${prefix}:${componentManagerCategory}:publishable-toggled`,
  selectComponent: `${prefix}:${componentManagerCategory}:select-component`,
  componentCreated: `${prefix}:${componentManagerCategory}:component-created`,
  componentMounted: `${prefix}:${componentManagerCategory}:component-mounted`,
  addComponent: `${prefix}:${componentManagerCategory}:add-component`,
  newComponent: `${prefix}:${componentManagerCategory}:new-component`,
  newComponentCleared: `${prefix}:${componentManagerCategory}:new-component-cleared`,
  hide: `${prefix}:${componentManagerCategory}:hide`,
  show: `${prefix}:${componentManagerCategory}:show`,
  showTabs: `${prefix}:${componentManagerCategory}:show-tabs`,
  tabChanged: `${prefix}:${componentManagerCategory}:tab-changed`,
  draggable: `${prefix}:${componentManagerCategory}:draggable`,
  selectPosition: `${prefix}:${componentManagerCategory}:select-position`,
  saveState: `${prefix}:${componentManagerCategory}:save-state`
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

const confirmCategory = 'confirm'
export const CONFIRM_DIALOG_EVENTS = {
  confirm: `${prefix}:${confirmCategory}:confirm`
}

export default {
  API_EVENTS,
  COMPONENT_MANAGER_EVENTS,
  ADMIN_BAR_EVENTS,
  NOTIFICATION_EVENTS,
  STATUS_EVENTS
}
