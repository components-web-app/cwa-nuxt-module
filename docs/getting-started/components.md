---
layout: default
parent: Getting Started
nav_order: 1
---
# Components

Getting started with components is easy with this module. You will have a `/components` directory for your nuxt application. Your CCWA specific components will live in a sub-directory. Create for following folder structure:
```
components
-- cwa/
|   -- components/
|   -- pages/
```

The UI components to be used from the API will live in `components/cwa/components` and page templates within `components/cwa/pages`

## Page Templates

Here is a simple example:
```vue
<template>
  <div>
    <div>
      <component-collection location="primary" :page-id="iri" />
    </div>
    <div>
      <component-collection location="secondary" :page-id="iri" />
    </div>
  </div>
</template>

<script>
import PageMixin from '@cwa/nuxt-module/core/mixins/PageMixin'

export default {
  mixins: [PageMixin]
}
</script>
```

Make sure you include the mixin.

You can structure your pages as you wish, and define areas in which component collections will render with their given names. If the collection does not exist for the page, the CWA module will instead render a placeholder and give an admin user the ability to create the component collection.

## Components

Here is a simple example

```vue
<template>
  <div>
    <h4>My custom HtmlContent component. See the HTML below. That was easy!</h4>
    <div v-html="resource.html" />
    <pre>{{ resource }}</pre>
  </div>
</template>

<script>
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
export default {
  mixins: [ComponentMixin]
}
</script>
```

Using the `ComponentMixin` you will have lots of data and methods available to you. This includes a `resource` object which is the data for the component returned from the API.
