<script setup lang="ts">
import type { ContentDocument, ProjectSummary } from '#shared/types'

const route = useRoute()
const id = route.params.id as string
const path = (route.params.path as string[]).map(encodeURIComponent).join('/')

const [{ data: project }, { data: document, error }] = await Promise.all([
  useFetch<ProjectSummary>(`/api/projects/${id}`),
  useFetch<ContentDocument>(`/api/projects/${id}/content/${path}`),
])
if (error.value)
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: errorMessage(error.value), fatal: true })

useHead({ title: () => `${document.value?.slug ?? 'Edit'} · Nulis` })
</script>

<template>
  <ContentEditor
    v-if="project && document"
    :key="document.path"
    :project-id="id"
    :repo="project.repo"
    :document="document"
    mode="edit"
  />
</template>
