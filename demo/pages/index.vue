<template>
  <div>
    Hello test world...
  </div>
</template>

<script>
export default {
  mounted() {
    console.log('index page...')
    console.log(this.$cwa)
  },
  middleware: 'routeLoader'
}
</script>
