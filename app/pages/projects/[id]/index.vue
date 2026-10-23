<script setup lang="ts">
import type { ContentListItem, ProjectDetail, ViewColumn } from '#shared/types'
import { getByPath } from '#shared/utils/object'

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const { data: project, refresh: refreshProject, error } = await useFetch<ProjectDetail>(`/api/projects/${id}`)
if (error.value)
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: errorMessage(error.value), fatal: true })
const { data: entries, status: entriesStatus, refresh: refreshEntries } = await useFetch<ContentListItem[]>(`/api/projects/${id}/content`, { default: () => [] })

useHead({ title: () => `${project.value?.repo ?? 'Project'} · Nulis` })

// --- search & sort -------------------------------------------------------
const query = ref('')
type SortKey = 'title' | 'updatedAt' | `fm:${string}`
const sort = ref<{ key: SortKey, dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 })
const columns = computed<ViewColumn[]>(() => project.value?.view.columns ?? [])

function sortValue(entry: ContentListItem, key: SortKey): string | number {
  const raw = key === 'title' ? entry.title : key === 'updatedAt' ? entry.updatedAt : getByPath(entry.frontmatter, key.slice(3))
  if (raw === undefined || raw === null || raw === '')
    return ''
  if (typeof raw === 'number' || typeof raw === 'boolean')
    return Number(raw)
  const asDate = key === 'updatedAt' || /^\d{4}-\d{2}-\d{2}/.test(String(raw)) ? Date.parse(String(raw)) : Number.NaN
  return Number.isNaN(asDate) ? (Array.isArray(raw) ? raw.join(', ') : String(raw)).toLowerCase() : asDate
}

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = (entries.value ?? []).filter(e => !q
    || e.title.toLowerCase().includes(q)
    || e.slug.toLowerCase().includes(q)
    || JSON.stringify(e.frontmatter).toLowerCase().includes(q))
  const { key, dir } = sort.value
  return [...list].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    // Empty values always sink to the bottom
    if (va === '' || vb === '')
      return va === vb ? 0 : va === '' ? 1 : -1
    return va < vb ? -dir : va > vb ? dir : 0
  })
})

function toggleSort(key: SortKey) {
  sort.value = sort.value.key === key ? { key, dir: sort.value.dir === 1 ? -1 : 1 } : { key, dir: key === 'updatedAt' ? -1 : 1 }
}
function sortIcon(key: SortKey) {
  if (sort.value.key !== key)
    return 'i-lucide-arrow-up-down'
  return sort.value.dir === 1 ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}
function ariaSort(key: SortKey) {
  if (sort.value.key !== key)
    return 'none'
  return sort.value.dir === 1 ? 'ascending' : 'descending'
}

const editPath = (entry: ContentListItem) => `/projects/${id}/edit/${entry.path.split('/').map(encodeURIComponent).join('/')}`

// --- actions --------------------------------------------------------------
const syncing = ref(false)
async function sync() {
  syncing.value = true
  try {
    const result = await $fetch<{ added: number, updated: number, removed: number }>(`/api/projects/${id}/sync`, { method: 'POST' })
    await Promise.all([refreshProject(), refreshEntries()])
    const changes = result.added + result.updated + result.removed
    toast.add({
      title: changes ? 'Synced with GitHub' : 'Already up to date',
      description: changes ? `${result.added} new, ${result.updated} updated, ${result.removed} removed` : undefined,
      color: 'success',
      icon: 'i-lucide-check',
    })
  }
  catch (e) {
    toast.add({ title: 'Sync failed', description: errorMessage(e), color: 'error' })
  }
  finally {
    syncing.value = false
  }
}

const editViewOpen = ref(false)
function onViewSaved(next: ViewColumn[]) {
  // useFetch data is a shallow ref: replace the object so the table re-renders
  if (project.value)
    project.value = { ...project.value, view: { columns: next } }
}

const removeOpen = ref(false)
const removing = ref(false)
async function removeProject() {
  removing.value = true
  try {
    await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
    toast.add({ title: `${project.value?.repo} removed from Nulis`, color: 'success', icon: 'i-lucide-check' })
    await navigateTo('/projects')
  }
  catch (e) {
    toast.add({ title: errorMessage(e), color: 'error' })
  }
  finally {
    removing.value = false
  }
}

const toDelete = ref<ContentListItem | null>(null)
const deleteOpen = computed({ get: () => !!toDelete.value, set: (v) => { if (!v) toDelete.value = null } })
const deleting = ref(false)
async function deleteEntry(message: string) {
  if (!toDelete.value)
    return
  deleting.value = true
  try {
    const url: string = `/api/projects/${id}/content/${toDelete.value.path}`
    await $fetch(url, { method: 'DELETE', body: { message } })
    toast.add({ title: 'Deleted and pushed', description: toDelete.value.title, color: 'success', icon: 'i-lucide-check' })
    toDelete.value = null
    await Promise.all([refreshProject(), refreshEntries()])
  }
  catch (e) {
    toast.add({ title: 'Delete failed', description: errorMessage(e), color: 'error' })
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="project">
    <AppBreadcrumb :items="[{ label: 'Projects', to: '/projects' }, { label: project.repo }]" />

    <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <h1 class="truncate text-[32px] font-bold leading-tight" data-testid="project-title">
            {{ project.repo }}
          </h1>
          <UBadge color="neutral" variant="outline" class="rounded-full" data-testid="ssg-badge">
            {{ SSG_LABELS[project.ssg] }}
          </UBadge>
        </div>
        <p class="mt-2 text-xs">
          {{ project.description || `${project.owner}/${project.repo}` }}
        </p>
        <p class="mt-1 text-xs text-ink-muted">
          <a :href="`https://github.com/${project.owner}/${project.repo}`" target="_blank" rel="noopener" class="hover:underline">{{ project.owner }}/{{ project.repo }}</a>
          · {{ project.branch }}
          <template v-if="project.lastSyncedAt">
            · synced {{ formatDateTime(project.lastSyncedAt) }}
          </template>
        </p>
      </div>
      <div class="flex flex-wrap gap-3 md:justify-end">
        <UButton icon="i-lucide-refresh-cw" :loading="syncing" data-testid="sync" @click="sync">
          Sync
        </UButton>
        <UButton color="secondary" icon="i-lucide-pencil" data-testid="edit-view" @click="editViewOpen = true">
          Edit view
        </UButton>
        <UButton color="error" data-testid="remove-project" @click="removeOpen = true">
          Remove Project
        </UButton>
      </div>
    </div>

    <div class="mb-4 mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton
        :to="`/projects/${id}/new`"
        icon="i-lucide-plus"
        variant="outline"
        color="neutral"
        :disabled="!project.collections.length"
        data-testid="new-content"
      >
        New content
      </UButton>
      <UInput v-model="query" icon="i-lucide-search" placeholder="Search" class="w-full sm:w-64" data-testid="search" />
    </div>

    <UAlert
      v-if="!project.collections.length"
      color="warning"
      variant="subtle"
      title="No content found"
      description="Nulis could not find markdown content in this repository. Push some content and press Sync."
      class="mb-4"
    />

    <div class="overflow-x-auto">
      <table class="w-full border-separate border-spacing-y-2 text-left">
        <thead>
          <tr>
            <th class="w-14 px-3 font-normal">
              #
            </th>
            <th class="px-3 font-normal" :aria-sort="ariaSort('title')">
              <button type="button" class="inline-flex items-center gap-1.5" @click="toggleSort('title')">
                Content <UIcon :name="sortIcon('title')" class="size-4" />
              </button>
            </th>
            <th v-for="col in columns" :key="col.key" class="px-3 font-normal" :aria-sort="ariaSort(`fm:${col.key}`)">
              <button type="button" class="inline-flex items-center gap-1.5 whitespace-nowrap" @click="toggleSort(`fm:${col.key}`)">
                {{ col.label }} <UIcon :name="sortIcon(`fm:${col.key}`)" class="size-4" />
              </button>
            </th>
            <th class="px-3 font-normal" :aria-sort="ariaSort('updatedAt')">
              <button type="button" class="inline-flex items-center gap-1.5 whitespace-nowrap" @click="toggleSort('updatedAt')">
                Last Updated <UIcon :name="sortIcon('updatedAt')" class="size-4" />
              </button>
            </th>
            <th class="w-10" />
          </tr>
        </thead>
        <tbody v-if="entriesStatus === 'pending' && !entries?.length">
          <tr v-for="i in 5" :key="i">
            <td :colspan="columns.length + 4">
              <USkeleton class="h-11 rounded-2xl" />
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr
            v-for="(entry, i) in rows"
            :key="entry.path"
            class="group cursor-pointer odd:bg-row"
            data-testid="content-row"
            @click="navigateTo(editPath(entry))"
          >
            <td class="rounded-l-2xl px-3 py-3 tabular-nums">
              {{ i + 1 }}
            </td>
            <td class="max-w-md px-3 py-3">
              <NuxtLink :to="editPath(entry)" class="block truncate group-hover:underline" :title="entry.path" @click.stop>
                {{ entry.slug }}
              </NuxtLink>
              <span v-if="entry.title !== entry.slug" class="block truncate text-xs text-ink-muted">{{ entry.title }}</span>
            </td>
            <td v-for="col in columns" :key="col.key" class="px-3 py-3" :data-testid="`cell-${col.key}`">
              <CellValue :value="getByPath(entry.frontmatter, col.key)" :type="col.type" />
            </td>
            <td class="whitespace-nowrap px-3 py-3">
              {{ formatDateTime(entry.updatedAt) }}
            </td>
            <td class="rounded-r-2xl px-2 py-3 text-right">
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                class="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                :aria-label="`Delete ${entry.slug}`"
                data-testid="delete-content"
                @click.stop="toDelete = entry"
              />
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="columns.length + 4" class="py-12 text-center text-ink-muted">
              {{ query ? `Nothing matches “${query}”.` : 'No content yet.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EditViewModal
      v-model:open="editViewOpen"
      :project-id="id"
      :columns="project.view.columns"
      :keys="project.frontmatterKeys"
      @saved="onViewSaved"
    />

    <ConfirmModal
      v-model:open="removeOpen"
      :title="`Remove ${project.repo}?`"
      confirm-label="Remove Project"
      :loading="removing"
      @confirm="removeProject"
    >
      <p>
        This removes the project from Nulis. The GitHub repository
        <strong>{{ project.owner }}/{{ project.repo }}</strong> and its content are not touched,
        and you can add it again at any time.
      </p>
    </ConfirmModal>

    <CommitModal
      v-model:open="deleteOpen"
      :title="`Delete ${toDelete?.slug}?`"
      :default-message="`Delete ${toDelete?.slug}`"
      confirm-label="Delete & push"
      destructive
      :loading="deleting"
      @submit="deleteEntry"
    />
  </div>
</template>
