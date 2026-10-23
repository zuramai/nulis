<script setup lang="ts">
useHead({ title: 'Settings · Nulis' })

const { user } = useUserSession()
const { data: github, refresh } = await useFetch<{ login: string, avatarUrl: string, connectedAt: string } | null>('/api/github')

const disconnectOpen = ref(false)
const disconnecting = ref(false)
async function disconnect() {
  disconnecting.value = true
  try {
    await $fetch('/api/github', { method: 'DELETE' })
    disconnectOpen.value = false
    await refresh()
    useToast().add({ title: 'GitHub disconnected', color: 'success', icon: 'i-lucide-check' })
  }
  finally {
    disconnecting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="mb-10 text-[32px] font-bold leading-tight">
      Settings
    </h1>

    <section class="mb-10">
      <h2 class="mb-3 text-lg font-bold">
        Account
      </h2>
      <div class="rounded-2xl bg-row px-5 py-4">
        Signed in as <strong>{{ user?.username }}</strong>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-lg font-bold">
        GitHub
      </h2>
      <div class="flex flex-col gap-4 rounded-2xl bg-row px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div v-if="github" class="flex items-center gap-3">
          <UAvatar v-if="github.avatarUrl" :src="github.avatarUrl" :alt="github.login" size="sm" />
          <UIcon v-else name="i-lucide-github" class="size-5" />
          <div>
            <div>Connected as <strong>{{ github.login }}</strong></div>
            <div class="text-xs text-ink-muted">
              since {{ formatDate(github.connectedAt) }}
            </div>
          </div>
        </div>
        <div v-else class="text-ink-muted">
          Not connected
        </div>
        <div class="flex gap-3">
          <UButton to="/auth/github" external variant="outline" color="neutral" icon="i-lucide-github">
            {{ github ? 'Reconnect' : 'Connect' }}
          </UButton>
          <UButton v-if="github" color="error" variant="outline" @click="disconnectOpen = true">
            Disconnect
          </UButton>
        </div>
      </div>
    </section>

    <ConfirmModal
      v-model:open="disconnectOpen"
      title="Disconnect GitHub?"
      description="Projects stay in Nulis, but you cannot sync or save until you connect again."
      confirm-label="Disconnect"
      :loading="disconnecting"
      @confirm="disconnect"
    />
  </div>
</template>
