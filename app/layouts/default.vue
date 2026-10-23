<script setup lang="ts">
const route = useRoute()
const { clear } = useUserSession()

const links = [
  { label: 'Projects', to: '/projects' },
  { label: 'Settings', to: '/settings' },
]

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen">
    <header class="mx-auto flex max-w-5xl items-center justify-between px-4 pt-8 sm:px-6 md:px-10 lg:px-0">
      <NuxtLink to="/projects" class="text-2xl font-bold tracking-tight">
        Nulis
      </NuxtLink>
      <nav class="flex items-center gap-6 text-base sm:gap-12" aria-label="Main">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="underline-offset-4 transition-colors hover:text-black"
          :class="route.path.startsWith(link.to) ? 'text-black underline' : 'text-ink-muted'"
        >
          {{ link.label }}
        </NuxtLink>
        <button type="button" class="text-ink-muted transition-colors hover:text-black" @click="signOut">
          Sign Out
        </button>
      </nav>
    </header>
    <main class="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 md:px-10 lg:px-0">
      <slot />
    </main>
  </div>
</template>
