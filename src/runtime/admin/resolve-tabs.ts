import { defineAsyncComponent } from 'vue'
import { CwaResourceMeta, ManagerTab } from '#cwa/module'

export const DEFAULT_TAB_ORDER = 50

interface resolveTabsOps { resourceType?: string, resourceConfig?: CwaResourceMeta }

function* getComponentGroupTabs () {
  yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/component.vue'))
  yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/position.vue'))
}
function* getComponentPositionTabs () {
  yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/static-component.vue'))
  yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/dynamic-component.vue'))
}

function* getComponentTabs () {
  yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/ui.vue'))
  yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/order.vue'))
  yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/publish.vue'))
}

export default function resolveTabs (ops: resolveTabsOps) {
  let tabs: ManagerTab[] = [
    defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/resource-info-tab.vue'))
  ]
  if (ops.resourceConfig?.managerTabs) {
    tabs = [...tabs, ...ops.resourceConfig.managerTabs]
  }

  if (ops.resourceType) {
    switch (ops.resourceType) {
      case 'ComponentGroup':
        tabs = [...tabs, ...getComponentGroupTabs()]
        break
      case 'ComponentPosition':
        tabs = [...tabs, ...getComponentPositionTabs()]
        break
      default:
        tabs = [...tabs, ...getComponentTabs()]
        break
    }
  }

  return tabs
}
