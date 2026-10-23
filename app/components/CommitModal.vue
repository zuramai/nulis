<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  defaultMessage: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
}>(), { title: 'Commit changes', confirmLabel: 'Commit & push' })
const emit = defineEmits<{ submit: [message: string] }>()
const open = defineModel<boolean>('open', { default: false })

const message = ref('')
watch(open, (isOpen) => {
  if (isOpen)
    message.value = props.defaultMessage
}, { immediate: true })

function submit() {
  if (message.value.trim())
    emit('submit', message.value.trim())
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    description="Your changes are committed and pushed to the repository's branch."
    :ui="{ title: 'text-xl font-bold', footer: 'justify-end' }"
  >
    <template #body>
      <form id="commit-form" @submit.prevent="submit">
        <UFormField label="Commit message" name="message" required>
          <UTextarea
            v-model="message"
            autofocus
            :rows="3"
            autoresize
            class="w-full"
            data-testid="commit-message"
            @keydown.meta.enter="submit"
            @keydown.ctrl.enter="submit"
          />
        </UFormField>
      </form>
    </template>
    <template #footer="{ close }">
      <UButton color="neutral" variant="outline" @click="close">
        Cancel
      </UButton>
      <UButton
        type="submit"
        form="commit-form"
        :color="destructive ? 'error' : 'primary'"
        :loading="loading"
        :disabled="!message.trim()"
        data-testid="commit-submit"
      >
        {{ confirmLabel }}
      </UButton>
    </template>
  </UModal>
</template>
