<script setup lang="ts">
import type { ProjectDetail } from '#shared/types'
import type { EditableDocument } from '~/components/ContentEditor.vue'
import { slugify } from '#shared/utils/object'

const route = useRoute()
const id = route.params.id as string
const { data: project } = await useFetch<ProjectDetail>(`/api/projects/${id}`)
useHead({ title: 'New content · Nulis' })

const BLANK = '__blank__'
const form = reactive({
  collection: project.value?.collections[0]?.name ?? '',
  template: project.value?.templates[0]?.name ?? BLANK,
  title: '',
})
const slug = computed(() => slugify(form.title))
const templateItems = computed(() => [
  ...(project.value?.templates ?? []).map(t => ({ label: t.path ? `${t.name} (${t.path})` : t.name, value: t.name })),
  { label: 'Blank document', value: BLANK },
])
const collectionItems = computed(() => (project.value?.collections ?? []).map(c => ({
  label: `${c.name} — ${c.baseDir || '/'}${c.layout === 'bundle' ? ' (bundles)' : ''}`,
  value: c.name,
})))
const selectedTemplate = computed(() => project.value?.templates.find(t => t.name === form.template))

const preparing = ref(false)
const error = ref('')
const document = ref<EditableDocument | null>(null)

async function prepare() {
  error.value = ''
  preparing.value = true
  try {
    document.value = await $fetch<EditableDocument>(`/api/projects/${id}/content/prepare`, {
      method: 'POST',
      body: { collection: form.collection, slug: slug.value, template: form.template === BLANK ? undefined : form.template },
    })
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    preparing.value = false
  }
}

const editor = ref<{ allowLeave: () => void }>()
async function onSaved(result: { path: string }) {
  editor.value?.allowLeave()
  await navigateTo(`/projects/${id}/edit/${result.path.split('/').map(encodeURIComponent).join('/')}`, { replace: true })
}
</script>

<template>
  <div v-if="project">
    <ContentEditor
      v-if="document"
      ref="editor"
      :project-id="id"
      :repo="project.repo"
      :document="document"
      mode="create"
      @saved="onSaved"
    />

    <div v-else>
      <AppBreadcrumb :items="[{ label: 'Projects', to: '/projects' }, { label: project.repo, to: `/projects/${id}` }, { label: 'new' }]" />
      <h1 class="mb-8 text-[32px] font-bold leading-tight">
        New content
      </h1>

      <form class="max-w-xl space-y-6" @submit.prevent="prepare">
        <UFormField label="Title" description="Used to build the file name and the title field of the template." required>
          <UInput v-model="form.title" autofocus placeholder="Benefits of learning music" class="w-full" data-testid="new-title" />
          <p v-if="slug" class="mt-2 text-xs text-ink-muted">
            Slug: <code>{{ slug }}</code>
          </p>
        </UFormField>

        <UFormField label="Template" description="Frontmatter and starter content for the new entry.">
          <USelect v-model="form.template" :items="templateItems" class="w-full" data-testid="template-select" />
        </UFormField>
        <pre
          v-if="selectedTemplate"
          class="max-h-60 overflow-auto rounded-2xl bg-row p-4 text-xs"
          data-testid="template-preview"
        >{{ selectedTemplate.body }}</pre>

        <UFormField v-if="collectionItems.length > 1" label="Collection" description="Where in the repository the file is created.">
          <USelect v-model="form.collection" :items="collectionItems" class="w-full" />
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" />

        <div class="flex justify-end gap-3">
          <UButton :to="`/projects/${id}`" color="neutral" variant="outline">
            Cancel
          </UButton>
          <UButton type="submit" :loading="preparing" :disabled="!slug" data-testid="continue">
            Continue
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>
