<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  loading?: boolean
}>(), { confirmLabel: 'Confirm' })
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description" :ui="{ title: 'text-xl font-bold', footer: 'justify-end' }">
    <template v-if="$slots.default" #body>
      <slot />
    </template>
    <template #footer="{ close }">
      <UButton color="neutral" variant="outline" @click="close">
        Cancel
      </UButton>
      <UButton color="error" :loading="loading" data-testid="confirm" @click="emit('confirm')">
        {{ confirmLabel }}
      </UButton>
    </template>
  </UModal>
</template>
