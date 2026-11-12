<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Create account · Nulis' })
</script>

<template>
  <div>
    <h1 class="mb-8 text-3xl font-bold">
      Create your account
    </h1>
    <AuthForm mode="register" />
    <p class="mt-6 text-center text-sm text-ink-muted">
      Already have an account?
      <ULink to="/login" class="font-medium text-primary" data-testid="login-link">
        Sign in
      </ULink>
    </p>
  </div>
</template>
