export const SCROLL_TARGET_TIMEOUT = 1000

const STABLE_TICKS = 3

export type ScrollTarget = { height: number } | { selector: string }

export interface WaitForScrollTargetOps {
  target: ScrollTarget
  isLoading: () => boolean
  readHeight: () => number
  onHeightChange: (cb: () => void) => () => void
  findElement: (selector: string) => boolean
  timeout: number
}

export function waitForScrollTarget({ target, isLoading, readHeight, onHeightChange, findElement, timeout }: WaitForScrollTargetOps): Promise<boolean> {
  const heightTarget = 'height' in target ? target.height : undefined
  const selector = 'selector' in target ? target.selector : ''

  const targetReached = () => (heightTarget !== undefined ? readHeight() >= heightTarget : findElement(selector))

  if (targetReached()) {
    return Promise.resolve(false)
  }

  return new Promise<boolean>((resolve) => {
    let settled = false
    const teardown: (() => void)[] = []
    let lastHeight = heightTarget === undefined ? 0 : readHeight()
    let heightChanged = false
    let stableTicks = 0

    const settle = () => {
      if (settled) {
        return
      }
      settled = true
      for (const stop of teardown.splice(0)) {
        stop()
      }
      resolve(true)
    }

    const tick = () => {
      if (settled) {
        return
      }
      if (targetReached()) {
        settle()
        return
      }
      if (heightTarget === undefined) {
        return
      }
      const height = readHeight()
      if (height !== lastHeight) {
        lastHeight = height
        heightChanged = true
        stableTicks = 0
        return
      }
      if (!heightChanged || isLoading()) {
        return
      }
      stableTicks++
      if (stableTicks >= STABLE_TICKS) {
        settle()
      }
    }

    const unsubscribe = onHeightChange(tick)
    if (settled) {
      unsubscribe()
      return
    }
    const timer = setTimeout(settle, timeout)
    teardown.push(unsubscribe, () => clearTimeout(timer))
  })
}
