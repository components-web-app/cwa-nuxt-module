import { computed, ref, Ref, watch } from 'vue'
import { AdminStore } from '../storage/stores/admin/admin-store'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName: string | null
}

// will be used to have additional properties not sent by the initial addToStack event
export interface ResourceStackItem extends _ResourceStackItem {
}

interface AddToStackWindowEvent {
  clickTarget: EventTarget | null
}

interface AddToStackEvent extends _ResourceStackItem, AddToStackWindowEvent {
}

export default class ComponentManager {
  private lastClickTarget: Ref<EventTarget|null> = ref(null)
  private currentResourceStack: Ref<ResourceStackItem[]> = ref([])
  private canvas: HTMLCanvasElement|undefined

  constructor (private adminStoreDefinition: AdminStore) {
    this.listenEditModeChange()
    this.listenCurrentStack()
  }

  public get resourceStack () {
    return computed(() => {
      return this.lastClickTarget.value ? [] : this.currentResourceStack.value
    })
  }

  public get currentStackItem () {
    return computed(() => {
      return this.lastClickTarget.value ? null : this.resourceStack.value?.[0] || null
    })
  }

  public resetStack () {
    this.lastClickTarget.value = null
    this.currentResourceStack.value = []
  }

  private listenEditModeChange () {
    watch(() => this.isEditing, (status) => {
      if (!status) {
        this.resetStack()
      }
    })
  }

  private listenCurrentStack () {
    watch(this.currentStackItem, (stackItem) => {
      if (!stackItem) {
        // this.clearCanvasHighlight()

      }
      // this.drawCanvasHighlight(stackItem)
    })
  }

  private isItemAlreadyInStack (iri: string): boolean {
    return !!this.currentResourceStack.value.find(el => el.iri === iri)
  }

  public addToStack (event: AddToStackEvent|AddToStackWindowEvent) {
    const { clickTarget, ...resourceStackItem } = event

    const isResourceClick = ('iri' in resourceStackItem)
    if (
      !this.isEditing ||
      (isResourceClick && this.isItemAlreadyInStack(resourceStackItem.iri) && this.lastClickTarget.value)
    ) {
      return
    }

    // we are starting a new stack - last click before was a window or has been reset
    if (!this.lastClickTarget.value) {
      this.resetStack()
    }

    isResourceClick && this.currentResourceStack.value.push(resourceStackItem)

    this.lastClickTarget.value = isResourceClick ? clickTarget : null
  }

  private get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }

  private drawCanvasHighlight (stackItem: ResourceStackItem) {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.canvas.style.position = 'absolute'
      this.canvas.style.top = '0'
      this.canvas.style.left = '0'
      this.canvas.style.zIndex = '40'
      this.canvas.style.pointerEvents = 'none'
      this.resizeCanvas()
      document.body.appendChild(this.canvas)
      window.addEventListener('resize', this.resizeCanvas.bind(this), false)
    }
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const clearCoords = {
      top: 999999999999,
      left: 99999999999,
      right: 0,
      bottom: 0
    }
    for (const domElement of stackItem.domElements) {
      const domRect = domElement.getBoundingClientRect()
      clearCoords.top = Math.min(clearCoords.top, domRect.top)
      clearCoords.left = Math.min(clearCoords.left, domRect.left)
      clearCoords.right = Math.max(clearCoords.right, domRect.right)
      clearCoords.bottom = Math.max(clearCoords.bottom, domRect.bottom)
    }

    ctx.fillStyle = 'rgba(0,0,0,.4)'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    const padding = 2
    const clearRectArea = {
      x: clearCoords.left - padding,
      y: clearCoords.top - padding,
      w: clearCoords.right - clearCoords.left + padding * 2,
      h: clearCoords.bottom - clearCoords.top + padding * 2
    }

    clearRectArea.y += Math.max(document.body.scrollTop, document.documentElement.scrollTop)
    clearRectArea.x += Math.max(document.body.scrollLeft, document.documentElement.scrollLeft)

    ctx.clearRect(clearRectArea.x, clearRectArea.y, clearRectArea.w, clearRectArea.h)
  }

  private resizeCanvas () {
    if (!this.canvas) {
      return
    }
    this.canvas.width = Math.max(
      document.body.scrollWidth, document.documentElement.scrollWidth,
      document.body.clientWidth, document.documentElement.clientWidth,
      document.body.offsetWidth, document.documentElement.offsetWidth,
      window.innerWidth
    )
    this.canvas.height = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.clientHeight, document.documentElement.clientHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      window.innerHeight
    )
    this.canvas.style.width = `${this.canvas.width}px`
    this.canvas.style.height = `${this.canvas.height}px`
  }

  private clearCanvasHighlight () {
    if (!this.canvas) {
      return
    }
    window.removeEventListener('resize', this.resizeCanvas)
    this.canvas.remove()
    this.canvas = undefined
  }
}
