---
layout: default
parent: Plugins
nav_order: 2
---
# Greensock (GSAP)

An immensely fun and powerful animation engine that we highly recommend.

If using the bonus content tgz you should add the file to your repo (be sure it is a private repo) and then add following node.yarn dependency:

```json
{
  "dependencies": {
    "gsap": "file:gsap-bonus.tgz"  
  }
}
```

## Example

Remember to include this plugin in your nuxt config.

plugins/gsap.js

```js
import { gsap, MorphSVGPlugin, ScrollToPlugin, EasePack, CustomEase } from 'gsap/all'

gsap.registerPlugin(MorphSVGPlugin, ScrollToPlugin, EasePack, CustomEase)

export default (ctx, inject) => {
  ctx.$gsap = gsap
  inject('gsap', gsap)
}
```
