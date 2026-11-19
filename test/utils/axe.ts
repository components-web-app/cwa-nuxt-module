import { expect } from 'vitest'
import { configureAxe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toHaveNoViolations: () => R
  }
}

expect.extend(matchers)

export const axe = configureAxe({
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
  rules: {
    'color-contrast': { enabled: false },
    'region': { enabled: false },
  },
})
