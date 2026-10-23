<script setup lang="ts">
export interface EditableDocument {
  path: string
  slug: string
  frontmatter: Record<string, unknown>
  body: string
  /** Blob sha the edit is based on; absent for new content */
  sha?: string
}

const props = defineProps<{
  projectId: string
  repo: string
  document: EditableDocument
  mode: 'create' | 'edit'
}>()
const emit = defineEmits<{ saved: [result: { path: string, sha: string }] }>()

const toast = useToast()
/** Frontmatter is plain JSON data; this also strips Vue's reactive proxies (structuredClone cannot). */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const original = ref<Record<string, unknown>>(clone(props.document.frontmatter))
const frontmatter = ref<Record<string, unknown>>(clone(props.document.frontmatter))
const body = ref(props.document.body)
const sha = ref(props.document.sha)
/** Editor output right after loading; Milkdown normalizes markdown, so compare against this */
const baseline = ref<string | null>(null)
const assetIds = ref<string[]>([])

const bodyDirty = computed(() => baseline.value !== null && body.value !== baseline.value)
const frontmatterDirty = computed(() => JSON.stringify(frontmatter.value) !== JSON.stringify(original.value))
const dirty = computed(() => props.mode === 'create' || bodyDirty.value || frontmatterDirty.value || assetIds.value.length > 0)

function onReady() {
  baseline.value = body.value
}

// --- save -----------------------------------------------------------------
const commitOpen = ref(false)
const saving = ref(false)
const conflict = ref('')
const defaultMessage = computed(() => `${props.mode === 'create' ? 'Add' : 'Update'} ${props.document.slug}`)

function openCommit() {
  if (!dirty.value) {
    toast.add({ title: 'No changes to save', icon: 'i-lucide-info' })
    return
  }
  commitOpen.value = true
}

async function save(message: string) {
  saving.value = true
  conflict.value = ''
  // Unchanged body: send the original text so the commit does not reformat it
  const outgoingBody = bodyDirty.value || props.mode === 'create' ? body.value : props.document.body
  try {
    let result: { sha: string, path?: string }
    if (props.mode === 'create') {
      result = await $fetch<{ sha: string, path: string }>(`/api/projects/${props.projectId}/content`, {
        method: 'POST',
        body: { path: props.document.path, frontmatter: frontmatter.value, body: outgoingBody, message, assets: assetIds.value },
      })
    }
    else {
      result = await $fetch<{ sha: string }>(`/api/projects/${props.projectId}/content/${props.document.path}`, {
        method: 'PUT',
        body: { frontmatter: frontmatter.value, body: outgoingBody, sha: sha.value, message, assets: assetIds.value },
      })
    }
    sha.value = result.sha
    original.value = clone(frontmatter.value)
    baseline.value = body.value
    assetIds.value = []
    commitOpen.value = false
    toast.add({ title: 'Changes pushed', description: message, color: 'success', icon: 'i-lucide-check' })
    emit('saved', { path: props.document.path, sha: result.sha })
  }
  catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 409) {
      commitOpen.value = false
      conflict.value = errorMessage(e)
    }
    else {
      toast.add({ title: 'Save failed', description: errorMessage(e), color: 'error' })
    }
  }
  finally {
    saving.value = false
  }
}

// --- unsaved changes guard ------------------------------------------------
let skipGuard = false
defineExpose({ allowLeave: () => { skipGuard = true } })

onBeforeRouteLeave(() => {
  if (!skipGuard && dirty.value && !saving.value && props.mode === 'edit')
    return window.confirm('You have unsaved changes. Leave without saving?')
})
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value && props.mode === 'edit')
    event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

if (import.meta.client) {
  window.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    event.preventDefault()
    openCommit()
  }
}
</script>

<template>
  <div>
    <AppBreadcrumb
      :items="[
        { label: 'Projects', to: '/projects' },
        { label: repo, to: `/projects/${projectId}` },
        { label: mode === 'create' ? 'new' : 'edit' },
      ]"
    />
    <div class="mb-10 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="truncate text-2xl" data-testid="content-title">
          {{ document.slug }}
        </h1>
        <p class="mt-1 truncate text-xs text-ink-muted">
          {{ document.path }}
        </p>
      </div>
      <UBadge v-if="dirty && mode === 'edit'" color="neutral" variant="soft" class="shrink-0 rounded-full">
        Unsaved changes
      </UBadge>
    </div>

    <UAlert
      v-if="conflict"
      class="mb-6"
      color="error"
      variant="subtle"
      title="Could not save"
      :description="conflict"
      :actions="mode === 'edit' ? [{ label: 'Reload latest', color: 'neutral', variant: 'outline', onClick: () => reloadNuxtApp() }] : []"
    />

    <FrontmatterPanel v-model="frontmatter" :original="original" class="mb-8" />

    <MarkdownEditor
      v-model="body"
      :project-id="projectId"
      :content-path="document.path"
      @uploaded="id => assetIds.push(id)"
      @ready="onReady"
    />

    <div class="mt-8 flex items-center justify-end gap-4">
      <span class="hidden text-xs text-ink-muted sm:inline">⌘S to save</span>
      <UButton size="lg" :disabled="!dirty" data-testid="save" @click="openCommit">
        Save
      </UButton>
    </div>

    <CommitModal
      v-model:open="commitOpen"
      :default-message="defaultMessage"
      :loading="saving"
      @submit="save"
    />
  </div>
</template>
