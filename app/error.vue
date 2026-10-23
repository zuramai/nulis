<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
useHead({ title: `${props.error.statusCode} · Nulis` })
</script>

<template>
  <UApp>
    <div class="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p class="text-6xl font-bold">
        {{ error.statusCode }}
      </p>
      <p class="max-w-md text-ink-muted">
        {{ error.statusCode === 404 ? 'This page or content could not be found.' : (error.statusMessage || error.message) }}
      </p>
      <UButton class="mt-4" @click="clearError({ redirect: '/projects' })">
        Back to projects
      </UButton>
    </div>
  </UApp>
</template>
