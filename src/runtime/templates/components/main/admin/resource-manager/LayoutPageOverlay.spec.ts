// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import LayoutPageOverlay from './LayoutPageOverlay.vue'
import * as cwaComposable from '#cwa/composables/cwa'

// Window size refs are shared so tests can drive them.
const windowSize = vi.hoisted(() => ({ width: { value: 1000 }, height: { value: 800 } }))
vi.mock('@vueuse/core', () => ({
  useWindowSize: () => windowSize,
}))

// Capture the canvas 2d contexts so we can assert drawing calls. Every canvas
// created (the template ref canvas plus the hatch helper canvas) gets a fresh
// mock context; `mainCtx` is the one drawCanvas() actually paints onto, which we
// identify because `reset()`/`fill()` are only called on that context.
let allCtxs: any[]
function makeCtx() {
  const ctx = {
    reset: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    createPattern: vi.fn(() => 'pattern'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
  allCtxs.push(ctx)
  return ctx
}
function mainCtx() {
  return allCtxs.find(c => c.reset.mock.calls.length > 0)
}

// happy-dom's canvas has no getContext; patch the prototype so the template
// ref canvas (created by Vue's renderer) and the hatch canvas both return mocks.
beforeEach(() => {
  allCtxs = []
  // @ts-expect-error happy-dom HTMLCanvasElement lacks getContext
  HTMLCanvasElement.prototype.getContext = vi.fn(() => makeCtx())
})

const eventBus = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
}

function makeBounded(rect: Partial<DOMRect>): { getBoundingClientRect(): DOMRect } {
  const full = {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect
  return { getBoundingClientRect: () => full }
}

function mockCwa(isEditingLayout = false) {
  eventBus.on.mockClear()
  eventBus.off.mockClear()
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    admin: {
      eventBus,
      resourceStackManager: {
        isEditingLayout: ref(isEditingLayout),
      },
    },
  }))
}

function mountComponent(opts: {
  isEditingLayout?: boolean
  layoutRect?: Partial<DOMRect>
  pageRect?: Partial<DOMRect>
} = {}) {
  mockCwa(opts.isEditingLayout)
  const layout = makeBounded(opts.layoutRect ?? { width: 1000, height: 800, top: 0, left: 0 })
  const page = makeBounded(opts.pageRect ?? { width: 600, height: 400, top: 50, left: 100 })
  return mount(LayoutPageOverlay, {
    props: { page, layout },
    global: {
      stubs: {
        // Render ClientOnly's default slot so the template content mounts.
        ClientOnly: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('LayoutPageOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    windowSize.width.value = 1000
    windowSize.height.value = 800
  })

  describe('initial render', () => {
    test('renders the overlay container and a canvas', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('#cwa-layout-page-overlay').exists()).toBe(true)
      expect(wrapper.find('canvas').exists()).toBe(true)
    })

    test('renders four div overlays in page-focus mode (default)', () => {
      const wrapper = mountComponent({ isEditingLayout: false })
      const overlays = wrapper.findAll('.cwa\\:backdrop-blur-\\[1\\.5px\\]')
      expect(overlays).toHaveLength(4)
    })

    test('renders a single div overlay in layout-editing mode', () => {
      const wrapper = mountComponent({ isEditingLayout: true })
      const overlays = wrapper.findAll('.cwa\\:backdrop-blur-\\[1\\.5px\\]')
      expect(overlays).toHaveLength(1)
    })
  })

  describe('page-focus overlay geometry', () => {
    test('the four overlays describe the area around the page (top, left, right, bottom)', () => {
      const wrapper = mountComponent({
        isEditingLayout: false,
        layoutRect: { width: 1000, height: 800, top: 0, left: 0 },
        pageRect: { width: 600, height: 400, top: 50, left: 100 },
      })
      const overlays = wrapper.findAll('.cwa\\:backdrop-blur-\\[1\\.5px\\]')
      const styles = overlays.map(o => o.attributes('style'))
      // top strip: full layout width, height = page top (50px)
      expect(styles[0]).toContain('width: 1000px')
      expect(styles[0]).toContain('height: 50px')
      // left strip: width = page left (100px), height = page height (400px)
      expect(styles[1]).toContain('width: 100px')
      expect(styles[1]).toContain('height: 400px')
      // right strip: left = page left + width = 700px
      expect(styles[2]).toContain('left: 700px')
      // bottom strip: top = page top + height = 450px
      expect(styles[3]).toContain('top: 450px')
    })
  })

  describe('layout-editing overlay geometry', () => {
    test('the single overlay covers exactly the page rect (relative to layout)', () => {
      const wrapper = mountComponent({
        isEditingLayout: true,
        layoutRect: { width: 1000, height: 800, top: 10, left: 20 },
        pageRect: { width: 600, height: 400, top: 60, left: 120 },
      })
      const overlay = wrapper.find('.cwa\\:backdrop-blur-\\[1\\.5px\\]')
      const style = overlay.attributes('style')
      // page coords are relative: top = 60-10 = 50, left = 120-20 = 100
      expect(style).toContain('top: 50px')
      expect(style).toContain('left: 100px')
      expect(style).toContain('width: 600px')
      expect(style).toContain('height: 400px')
    })
  })

  describe('event bus wiring', () => {
    test('registers a redrawFocus listener on mount', () => {
      mountComponent()
      expect(eventBus.on).toHaveBeenCalledWith('redrawFocus', expect.any(Function))
    })

    test('removes the redrawFocus listener on unmount', () => {
      const wrapper = mountComponent()
      const registered = eventBus.on.mock.calls.find(c => c[0] === 'redrawFocus')?.[1]
      wrapper.unmount()
      expect(eventBus.off).toHaveBeenCalledWith('redrawFocus', registered)
    })

    test('redraw recomputes the div overlays', async () => {
      const wrapper = mountComponent({ isEditingLayout: false })
      const redraw = eventBus.on.mock.calls.find(c => c[0] === 'redrawFocus')?.[1] as () => Promise<void>
      expect(redraw).toBeTruthy()
      await redraw()
      await nextTick()
      await flushPromises()
      // after redraw, overlays are repopulated (page-focus mode -> 4)
      expect(wrapper.findAll('.cwa\\:backdrop-blur-\\[1\\.5px\\]')).toHaveLength(4)
    })
  })

  describe('canvas drawing', () => {
    async function triggerRedraw() {
      const redraw = eventBus.on.mock.calls.find(c => c[0] === 'redrawFocus')?.[1] as () => Promise<void>
      await redraw()
      await nextTick()
      await flushPromises()
    }

    test('draws the page-focus shape on the canvas after redraw', async () => {
      mountComponent({ isEditingLayout: false })
      await triggerRedraw()
      const ctx = mainCtx()
      expect(ctx).toBeTruthy()
      expect(ctx.reset).toHaveBeenCalled()
      expect(ctx.fill).toHaveBeenCalled()
      // page-focus path starts at the origin
      expect(ctx.moveTo).toHaveBeenCalledWith(0, 0)
    })

    test('draws the layout-focus shape (starting at the page corner) when editing layout', async () => {
      mountComponent({
        isEditingLayout: true,
        layoutRect: { width: 1000, height: 800, top: 0, left: 0 },
        pageRect: { width: 600, height: 400, top: 50, left: 100 },
      })
      await triggerRedraw()
      const ctx = mainCtx()
      expect(ctx).toBeTruthy()
      // layout-focus path begins at the page's top-left (relative coords)
      expect(ctx.moveTo).toHaveBeenCalledWith(100, 50)
    })

    test('fills the canvas using a repeating hatch pattern', async () => {
      mountComponent()
      await triggerRedraw()
      const ctx = mainCtx()
      expect(ctx).toBeTruthy()
      // hatch canvas produced a pattern that is used as the fill style
      expect(ctx.createPattern).toHaveBeenCalledWith(expect.anything(), 'repeat')
      expect(ctx.fillStyle).toBe('pattern')
    })
  })
})
