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
    <USeparator label="New to Nulis?" class="my-6" />
    <UButton to="/register" size="lg" block color="neutral" variant="outline" data-testid="register-link">
      Register
    </UButton>
  </div>
</template>
