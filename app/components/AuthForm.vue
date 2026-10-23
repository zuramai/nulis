<script setup lang="ts">
const props = defineProps<{
  mode: 'setup' | 'login'
}>()

const state = reactive({ username: '', password: '' })
const error = ref('')
const loading = ref(false)
const { fetch: refreshSession } = useUserSession()

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch(props.mode === 'setup' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: state })
    await refreshSession()
    await navigateTo('/')
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- method="post" keeps credentials out of the URL if submitted before hydration -->
  <form class="space-y-5" method="post" @submit.prevent="submit">
    <UFormField label="Username" name="username" size="lg">
      <UInput v-model="state.username" autocomplete="username" required class="w-full" data-testid="username" />
    </UFormField>
    <UFormField label="Password" name="password" size="lg" :hint="mode === 'setup' ? 'At least 8 characters' : undefined">
      <UInput
        v-model="state.password"
        type="password"
        :autocomplete="mode === 'setup' ? 'new-password' : 'current-password'"
        required
        class="w-full"
        data-testid="password"
      />
    </UFormField>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <UButton type="submit" size="lg" block :loading="loading">
      {{ mode === 'setup' ? 'Create account' : 'Sign in' }}
    </UButton>
  </form>
</template>
