<script setup lang="ts">
import { emptyValue, fromRows, invalidJson, newRow, toRows, type FieldKind, type FieldRow } from '~/utils/frontmatter-rows'

const props = defineProps<{
  /** The frontmatter as loaded; "Reset" returns to it */
  original: Record<string, unknown>
}>()
const frontmatter = defineModel<Record<string, unknown>>({ required: true })
const open = ref(false)

const KINDS: { label: string, value: FieldKind }[] = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'List', value: 'list' },
  { label: 'JSON', value: 'json' },
]

const rows = ref<FieldRow[]>(toRows(frontmatter.value))
watch(() => props.original, (value) => {
  rows.value = toRows(value)
})

watch(rows, (value) => {
  frontmatter.value = fromRows(value)
}, { deep: true })

const dirty = computed(() => JSON.stringify(frontmatter.value) !== JSON.stringify(props.original))
const duplicateKeys = computed(() => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const row of rows.value) {
    const key = row.key.trim()
    if (key && seen.has(key))
      dupes.add(key)
    seen.add(key)
  }
  return dupes
})

function addField() {
  rows.value.push(newRow())
  open.value = true
}

function changeKind(row: FieldRow, kind: FieldKind) {
  const previous = row.value
  row.kind = kind
  if (kind === 'list')
    row.value = typeof previous === 'string' && previous ? previous.split(',').map(s => s.trim()).filter(Boolean) : []
  else if (kind === 'text' && Array.isArray(previous))
    row.value = previous.join(', ')
  else
    row.value = emptyValue(kind)
}

function reset() {
  rows.value = toRows(props.original)
}

const summary = computed(() => {
  const count = rows.value.filter(r => r.key.trim()).length
  return `${count} ${count === 1 ? 'field' : 'fields'}`
})
</script>

<template>
  <section class="rounded-[14px] border border-black" data-testid="frontmatter">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-4 px-6 py-2 text-left"
      :aria-expanded="open"
      aria-controls="frontmatter-fields"
      data-testid="frontmatter-toggle"
      @click="open = !open"
    >
      <span class="flex items-center gap-3">
        Frontmatter
        <span class="text-xs text-ink-muted">{{ summary }}<template v-if="dirty"> · edited</template></span>
      </span>
      <UIcon name="i-lucide-chevron-down" class="size-6 transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <div v-show="open" id="frontmatter-fields" class="px-6 pb-6 pt-2">
      <div class="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,4fr)_auto] gap-3 px-1 pb-2 sm:grid">
        <span>Key</span>
        <span>Type</span>
        <span>Value</span>
        <span class="w-8" />
      </div>

      <div class="space-y-3">
        <div
          v-for="(row, i) in rows"
          :key="row.id"
          class="grid grid-cols-1 items-start gap-2 rounded-2xl bg-row p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,4fr)_auto] sm:gap-3 sm:bg-transparent sm:p-0"
          :data-testid="`fm-row-${row.key || i}`"
        >
          <UInput
            v-model="row.key"
            placeholder="key"
            aria-label="Key"
            class="w-full"
            :color="duplicateKeys.has(row.key.trim()) ? 'error' : undefined"
            :highlight="duplicateKeys.has(row.key.trim())"
          />
          <USelect :model-value="row.kind" :items="KINDS" aria-label="Type" class="w-full" @update:model-value="(k: FieldKind) => changeKind(row, k)" />

          <UInputTags
            v-if="row.kind === 'list'"
            v-model="(row.value as string[])"
            placeholder="Add and press Enter"
            aria-label="Value"
            class="w-full"
            :ui="{ item: 'bg-black text-white rounded-full', itemDelete: 'text-white hover:text-white/80' }"
          />
          <div v-else-if="row.kind === 'boolean'" class="flex h-8 items-center">
            <USwitch v-model="(row.value as boolean)" :label="row.value ? 'true' : 'false'" />
          </div>
          <UInput v-else-if="row.kind === 'number'" v-model.number="(row.value as number)" type="number" step="any" aria-label="Value" class="w-full" />
          <UTextarea
            v-else-if="row.kind === 'json'"
            v-model="(row.value as string)"
            autoresize
            :rows="2"
            aria-label="Value"
            class="w-full font-mono"
            :color="invalidJson(row) ? 'error' : undefined"
            :highlight="invalidJson(row)"
          />
          <UInput v-else v-model="(row.value as string)" aria-label="Value" class="w-full" />

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            :aria-label="`Remove ${row.key || 'field'}`"
            class="justify-self-end"
            @click="rows.splice(i, 1)"
          />
        </div>
      </div>

      <p v-if="duplicateKeys.size" class="mt-3 text-sm text-alarm-600">
        Duplicate keys: {{ [...duplicateKeys].join(', ') }}. Only the last one is kept.
      </p>

      <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
        <UButton icon="i-lucide-plus" variant="outline" color="neutral" data-testid="add-field" @click="addField">
          Add field
        </UButton>
        <div class="flex gap-3">
          <UButton variant="outline" color="neutral" :disabled="!dirty" @click="reset">
            Reset
          </UButton>
          <UButton @click="open = false">
            Done
          </UButton>
        </div>
      </div>
    </div>
  </section>
</template>
