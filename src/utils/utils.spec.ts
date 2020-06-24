import * as utils from '.'

describe('Utils', () => {
  test('should be disabled for the cwa middleware', () => {
    expect(utils.cwaRouteDisabled({ matched: [{ components: [{ _Ctor: { 0: { options: { cwa: false } } } }] }] })).toBe(true)
  })

  test('should enable cwa middleware', () => {
    expect(utils.cwaRouteDisabled({ matched: [{ components: [{ _Ctor: { 0: { options: { cwa: true } } } }] }] })).toBe(false)
    expect(utils.cwaRouteDisabled({ matched: [{ components: [{ _Ctor: {} }] }] })).toBe(false)
  })
})
