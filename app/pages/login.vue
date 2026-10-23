<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in · Nulis' })
</script>

<template>
  <div>
    <h1 class="mb-8 text-3xl font-bold">
      Sign in
    </h1>
    <AuthForm mode="login" />
  </div>
</template>
