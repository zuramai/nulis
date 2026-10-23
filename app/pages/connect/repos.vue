<script setup lang="ts">
import type { RepoOption } from '#shared/types'

useHead({ title: 'Select repositories · Nulis' })

type Repo = RepoOption & { added: boolean }
interface AddResult { fullName: string, id?: string, ssg?: string, postCount?: number, error?: string }

const { data: repos, status, error: loadError, refresh } = await useFetch<Repo[]>('/api/github/repos', { lazy: true, server: false })
const query = ref('')
const selected = ref<Set<string>>(new Set())
const submitting = ref(false)
const results = ref<AddResult[] | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (repos.value ?? []).filter(r => !q || r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
})

function toggle(repo: Repo) {
  if (repo.added)
    return
  const next = new Set(selected.value)
  if (next.has(repo.fullName))
    next.delete(repo.fullName)
  else
    next.add(repo.fullName)
  selected.value = next
}

async function submit() {
  submitting.value = true
  try {
    const picked = (repos.value ?? []).filter(r => selected.value.has(r.fullName)).map(r => ({ owner: r.owner, repo: r.repo }))
    const response = await $fetch<{ results: AddResult[] }>('/api/projects', { method: 'POST', body: { repos: picked } })
    results.value = response.results
    selected.value = new Set()
    await refresh()
  }
  catch (e) {
    useToast().add({ title: errorMessage(e), color: 'error' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <AppBreadcrumb :items="[{ label: 'Projects', to: '/projects' }, { label: 'Add project' }]" />
    <h1 class="mb-2 text-[32px] font-bold leading-tight">
      Select repositories
    </h1>
    <p class="mb-8 text-sm text-ink-muted">
      Each repository becomes a project. Nulis detects the static site generator and where its content lives.
    </p>

    <div v-if="results" class="mb-10 space-y-3" data-testid="import-results">
      <div
        v-for="result in results"
        :key="result.fullName"
        class="flex items-center justify-between rounded-2xl bg-row px-4 py-3"
      >
        <div class="flex items-center gap-3">
          <UIcon :name="result.error ? 'i-lucide-x' : 'i-lucide-check'" :class="result.error ? 'text-alarm-500' : 'text-black'" />
          <span>{{ result.fullName }}</span>
        </div>
        <span v-if="result.error" class="text-sm text-alarm-600">{{ result.error }}</span>
        <span v-else class="text-sm text-ink-muted">
          {{ SSG_LABELS[result.ssg ?? 'generic'] }} · {{ result.postCount }} {{ result.postCount === 1 ? 'entry' : 'entries' }}
        </span>
      </div>
      <div class="flex justify-end">
        <UButton to="/projects" trailing-icon="i-lucide-arrow-right">
          Go to projects
        </UButton>
      </div>
    </div>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UInput v-model="query" icon="i-lucide-search" placeholder="Search repositories" class="w-full sm:w-80" />
      <UButton
        :disabled="!selected.size"
        :loading="submitting"
        data-testid="add-selected"
        @click="submit"
      >
        {{ submitting ? 'Importing…' : selected.size ? `Add ${selected.size} ${selected.size === 1 ? 'project' : 'projects'}` : 'Add projects' }}
      </UButton>
    </div>

    <UAlert v-if="loadError" color="error" variant="subtle" :title="errorMessage(loadError)" class="mb-4" />

    <div v-if="status === 'pending' || status === 'idle'" class="space-y-2">
      <USkeleton v-for="i in 6" :key="i" class="h-14 rounded-2xl" />
    </div>
    <ul v-else class="space-y-1" role="listbox" aria-multiselectable="true" aria-label="Repositories">
      <li
        v-for="repo in filtered"
        :key="repo.fullName"
        role="option"
        :aria-selected="selected.has(repo.fullName)"
        :aria-disabled="repo.added"
        class="flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 transition-colors odd:bg-row"
        :class="repo.added ? 'cursor-default opacity-50' : 'hover:bg-neutral-100'"
        :data-testid="`repo-${repo.fullName}`"
        @click="toggle(repo)"
      >
        <UCheckbox :model-value="repo.added || selected.has(repo.fullName)" :disabled="repo.added" tabindex="-1" class="pointer-events-none" />
        <UIcon name="i-lucide-github" class="size-5 shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate">{{ repo.fullName }}</span>
            <UIcon v-if="repo.private" name="i-lucide-lock" class="size-3.5 text-ink-muted" />
            <UBadge v-if="repo.added" color="neutral" variant="soft" size="sm">
              Added
            </UBadge>
          </div>
          <p v-if="repo.description" class="truncate text-xs text-ink-muted">
            {{ repo.description }}
          </p>
        </div>
        <span v-if="repo.pushedAt" class="hidden text-sm text-ink-muted sm:block">{{ formatDate(repo.pushedAt) }}</span>
      </li>
      <li v-if="!filtered.length" class="py-10 text-center text-ink-muted">
        No repositories match “{{ query }}”.
      </li>
    </ul>
  </div>
</template>
