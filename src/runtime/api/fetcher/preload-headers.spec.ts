import { describe, expect, test } from 'vitest'
import preloadHeaders from './preload-headers'

describe('Preload headers export is correct', () => {
  test('Exported object is correct', () => {
    expect(preloadHeaders).toStrictEqual({
      ROUTE: [
        '/page/layout/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
        '/page/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
        '/pageData/page/layout/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
        '/pageData/page/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
      ],
      PAGE: [
        '/layout/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
        '/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
      ],
      LAYOUT: [
        '/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
      ],
      PAGE_DATA: [
        '/page/layout/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
        '/page/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
      ],
      COMPONENT_GROUP: [
        '/componentPositions/*/component/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
      ],
      COMPONENT_POSITION: [
        '/component/componentGroups/*/componentPositions/*/component/componentGroups/*/componentPositions/*/component',
      ],
      COMPONENT: ['/componentGroups/*/componentPositions/*/component'],
    })
  })
})
