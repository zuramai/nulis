<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Connect GitHub · Nulis' })
const route = useRoute()
</script>

<template>
  <div>
    <p class="mb-2 text-sm text-ink-muted">
      Step 2 of 3
    </p>
    <h1 class="mb-2 text-3xl font-bold">
      Connect GitHub
    </h1>
    <p class="mb-8 text-ink-muted">
      Nulis reads your site's markdown from GitHub and saves your edits as commits.
      It needs access to the repositories you choose next.
    </p>
    <UAlert
      v-if="route.query.error"
      class="mb-6"
      color="error"
      variant="subtle"
      title="GitHub did not authorize Nulis. Please try again."
    />
    <UButton to="/auth/github" external size="xl" block icon="i-lucide-github" data-testid="connect-github">
      Continue with GitHub
    </UButton>
  </div>
</template>
