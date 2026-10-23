<script setup lang="ts">
import type { ColumnType } from '#shared/types'

const props = defineProps<{
  value: unknown
  type: ColumnType
}>()

const tags = computed(() => {
  if (Array.isArray(props.value))
    return props.value.map(String)
  if (typeof props.value === 'string' && props.value)
    return props.value.split(',').map(s => s.trim()).filter(Boolean)
  return []
})

const text = computed(() => {
  const v = props.value
  if (v === undefined || v === null || v === '')
    return ''
  if (props.type === 'timestamp')
    return formatDateTime(v) || String(v)
  if (props.type === 'date')
    return formatDate(v) || String(v)
  if (Array.isArray(v))
    return v.join(', ')
  if (typeof v === 'object')
    return JSON.stringify(v)
  return String(v)
})
</script>

<template>
  <span v-if="type === 'tags'" class="flex flex-wrap gap-1">
    <span v-for="tag in tags" :key="tag" class="rounded-full bg-black px-2 py-0.5 text-xs text-white">{{ tag }}</span>
  </span>
  <span v-else-if="type === 'boolean'">
    <UIcon v-if="value === true || value === 'true'" name="i-lucide-check" aria-label="Yes" />
    <span v-else-if="value === false || value === 'false'" class="text-ink-muted">—</span>
  </span>
  <span v-else :class="type === 'number' ? 'tabular-nums' : ''">{{ text }}</span>
</template>
