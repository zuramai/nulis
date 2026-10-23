<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Create account · Nulis' })
</script>

<template>
  <div>
    <h1 class="mb-2 text-3xl font-bold">
      Create your account
    </h1>
    <p class="mb-8 text-ink-muted">
      Welcome to Nulis. This account owns this installation; registration closes once it is created.
    </p>
    <AuthForm mode="setup" />
  </div>
</template>
