---
layout: default
parent: Plugins
nav_order: 3
---
# Font Awesome

Using the `@fortawesome/vue-fontawesome` you can easily harness and customise which Font Awesome icons to load in.

Here are all the packages, choose which ever you need. `@fortawesome/vue-fontawesome` and `@fortawesome/fontawesome-svg-core` are required.

```bash
yarn install @fortawesome/vue-fontawesome @fortawesome/fontawesome-svg-core @fortawesome/free-brands-svg-icons @fortawesome/free-solid-svg-icons
```

## Example

Remember to include this plugin in your nuxt config.

plugins/fontawesome.js

```js
import Vue from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faCheck, faExclamationTriangle, faSave, faEdit, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'

library.add(faCheck, faExclamationTriangle, faSave, faEdit, faSync, faTrash)

Vue.component('font-awesome-icon', FontAwesomeIcon)
```
