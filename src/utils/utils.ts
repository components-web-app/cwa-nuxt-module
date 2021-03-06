// TODO: Should import Route type from 'vue-router'
interface VueComponent { options: object, _Ctor: VueComponent }
type match = { components: VueComponent[] }
type Route = { matched: match[] }

export function cwaRouteDisabled (route: Route): boolean {
  return routeOption(route, 'cwa', false)
}

export function routeOption (route: Route, key, value) {
  return route.matched.some((m) => {
    return Object.values(m.components).some(component =>
      process.client ? component.options && component.options[key] === value
        : Object.values(component._Ctor).some(
          ctor => ctor.options && ctor.options[key] === value
        )
    )
  })
}

/**
 * Get property defined by dot notation in string.
 * Based on  https://github.com/dy/dotprop (MIT)
 *
 * @param  {Object} holder   Target object where to look property up
 * @param  {string} propName Dot notation, like 'this.a.b.c'
 * @return {*}          A property value
 */
export function getProp (holder, propName) {
  if (!propName || !holder) {
    return holder
  }

  if (propName in holder) {
    return holder[propName]
  }

  const propParts = Array.isArray(propName) ? propName : (propName + '').split('.')

  let result = holder
  while (propParts.length && result) {
    result = result[propParts.shift()]
  }

  return result
}
