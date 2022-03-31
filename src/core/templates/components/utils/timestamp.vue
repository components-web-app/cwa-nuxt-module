<template>
  <span>
    {{ formattedTimestamp }}
  </span>
</template>

<script>
export default {
  props: {
    timestamp: {
      type: Date,
      required: true
    },
    updateFrequency: {
      type: Number,
      default: 5000
    }
  },
  data() {
    return {
      formattedTimestamp: null,
      updateInterval: null
    }
  },
  mounted() {
    this.updateTimestamp()
    this.updateInterval = setInterval(
      this.updateTimestamp,
      this.updateFrequency
    )
  },
  beforeDestroy() {
    clearInterval(this.updateInterval)
  },
  methods: {
    async updateTimestamp() {
      const { default: moment } = await import('moment')
      this.formattedTimestamp = moment(this.timestamp).fromNow()
    }
  }
}
</script>
