<script setup lang="ts">
import type { ColumnType, ViewColumn } from '#shared/types'

const props = defineProps<{
  projectId: string
  columns: ViewColumn[]
  /** Frontmatter keys found across the project's content (dotted for nested keys) */
  keys: string[]
}>()
const emit = defineEmits<{ saved: [columns: ViewColumn[]] }>()
const open = defineModel<boolean>('open', { default: false })

const TYPES: { label: string, value: ColumnType }[] = [
  { label: 'Text', value: 'text' },
  { label: 'Date', value: 'date' },
  { label: 'Timestamp', value: 'timestamp' },
  { label: 'Tags', value: 'tags' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Number', value: 'number' },
]

const rows = ref<ViewColumn[]>([])
const keyOptions = ref<string[]>([])
const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    rows.value = props.columns.map(c => ({ ...c }))
    keyOptions.value = [...props.keys]
  }
}, { immediate: true })

function guessType(key: string): ColumnType {
  if (/date|_at$|At$|time|lastmod/i.test(key))
    return 'timestamp'
  if (/tags|categories|keywords/i.test(key))
    return 'tags'
  if (/^(draft|published|featured|hidden)$/i.test(key))
    return 'boolean'
  return 'text'
}

function humanize(key: string) {
  const last = key.split('.').at(-1) ?? key
  const words = last.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function addRow() {
  const used = new Set(rows.value.map(r => r.key))
  const key = keyOptions.value.find(k => !used.has(k)) ?? ''
  rows.value.push({ label: key ? humanize(key) : '', key, type: key ? guessType(key) : 'text' })
}

function onKeyChange(row: ViewColumn, key: string) {
  const previousLabel = humanize(row.key)
  row.key = key
  if (!row.label || row.label === previousLabel)
    row.label = humanize(key)
  row.type = guessType(key)
}

function onCreateKey(key: string, row: ViewColumn) {
  if (!keyOptions.value.includes(key))
    keyOptions.value.push(key)
  onKeyChange(row, key)
}

const invalid = computed(() => rows.value.some(r => !r.label.trim() || !r.key.trim()))

async function save() {
  saving.value = true
  try {
    const { columns } = await $fetch<{ columns: ViewColumn[] }>(`/api/projects/${props.projectId}/view`, {
      method: 'PUT',
      body: { columns: rows.value.map(r => ({ ...r, label: r.label.trim(), key: r.key.trim() })) },
    })
    emit('saved', columns)
    open.value = false
    useToast().add({ title: 'View updated', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    useToast().add({ title: errorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit View"
    description="Choose which frontmatter fields appear as columns. Entries without a field show an empty cell."
    :ui="{ content: 'sm:max-w-3xl', title: 'text-xl font-bold', footer: 'justify-end' }"
  >
    <template #body>
      <div class="mb-4 flex justify-end">
        <UButton size="sm" icon="i-lucide-plus" data-testid="add-column" @click="addRow">
          Add
        </UButton>
      </div>
      <div v-if="rows.length" class="hidden grid-cols-[1fr_1fr_1fr_auto] gap-4 px-1 pb-2 sm:grid">
        <span>Name</span>
        <span>Frontmatter</span>
        <span>Type</span>
        <span class="w-8" />
      </div>
      <div class="space-y-3">
        <div
          v-for="(row, i) in rows"
          :key="i"
          class="grid grid-cols-1 items-center gap-2 rounded-2xl bg-row p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:gap-4 sm:bg-transparent sm:p-0"
          :data-testid="`column-row-${i}`"
        >
          <UInput v-model="row.label" placeholder="Column name" aria-label="Column name" class="w-full" />
          <USelectMenu
            :model-value="row.key"
            :items="keyOptions"
            create-item
            placeholder="Choose a key"
            aria-label="Frontmatter key"
            class="w-full"
            @update:model-value="(key: string) => onKeyChange(row, key)"
            @create="(key: string) => onCreateKey(key, row)"
          />
          <USelect v-model="row.type" :items="TYPES" aria-label="Column type" class="w-full" />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            :aria-label="`Remove ${row.label || 'column'}`"
            class="justify-self-end"
            @click="rows.splice(i, 1)"
          />
        </div>
        <p v-if="!rows.length" class="py-8 text-center text-sm text-ink-muted">
          Only the default columns are shown. Add a column to show a frontmatter field.
        </p>
      </div>
    </template>
    <template #footer="{ close }">
      <UButton color="neutral" variant="outline" @click="close">
        Cancel
      </UButton>
      <UButton :loading="saving" :disabled="invalid" data-testid="save-view" @click="save">
        Save
      </UButton>
    </template>
  </UModal>
</template>
