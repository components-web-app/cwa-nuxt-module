<script lang="ts" setup>
defineProps<{
  title?: string
  description?: string
  siteName?: string
}>()
</script>

<template>
  <div style="display: flex; width: 1200px; height: 630px; background: #0f1117; padding: 70px 80px; flex-direction: column;">
    <svg
      width="180"
      height="52"
      viewBox="181 185 906 260"
      style="fill: white; flex-shrink: 0;"
    >
      <path d="M411,232.558892 L311.990506,315.54434 L395.186608,414.582148 C395.083121,414.669432 394.979462,414.756587 394.875631,414.843614 C340.020479,460.820814 258.000365,453.391191 211.678578,398.249085 C165.356791,343.10698 172.27445,261.133586 227.129601,215.156386 C281.984753,169.179186 364.004868,176.608809 410.326654,231.750915 C410.552367,232.019606 410.776815,232.288934 411,232.558892 Z M731,444.98882 L606.047047,318.63887 L482,444.072786 L482,186 L731,186 L731,444.98882 Z M784,445 L935,186 L1087,445 L784,445 Z" />
    </svg>
    <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center; gap: 20px;">
      <div
        v-if="title"
        style="font-size: 68px; font-weight: 700; color: white; line-height: 1.1; letter-spacing: -1px;"
      >
        {{ title }}
      </div>
      <div
        v-if="description"
        style="font-size: 28px; color: rgba(255,255,255,0.6); line-height: 1.4;"
      >
        {{ description }}
      </div>
    </div>
    <div style="display: flex; justify-content: flex-end;">
      <div style="font-size: 22px; color: rgba(255,255,255,0.3);">
        {{ siteName || 'cwa.rocks' }}
      </div>
    </div>
  </div>
</template>
