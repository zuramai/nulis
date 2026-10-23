<script setup lang="ts">
import type { ProjectSummary } from '#shared/types'

useHead({ title: 'Projects · Nulis' })
const { data: projects, status } = await useFetch<ProjectSummary[]>('/api/projects')
</script>

<template>
  <div>
    <div class="mb-8 flex items-end justify-between gap-4">
      <h1 class="text-[32px] font-bold leading-tight">
        Projects
      </h1>
      <UButton to="/connect/repos" icon="i-lucide-plus" data-testid="add-project">
        Add Project
      </UButton>
    </div>

    <div v-if="status === 'pending'" class="space-y-2">
      <USkeleton v-for="i in 3" :key="i" class="h-12 rounded-2xl" />
    </div>

    <div v-else-if="!projects?.length" class="rounded-[21px] border border-dashed border-neutral-300 px-6 py-16 text-center">
      <p class="mb-4 text-lg">
        No projects yet.
      </p>
      <UButton to="/connect/repos">
        Add your first repository
      </UButton>
    </div>

    <table v-else class="w-full border-separate border-spacing-y-2 text-left">
      <thead>
        <tr class="font-normal">
          <th class="w-16 px-3 font-normal">
            #
          </th>
          <th class="px-3 font-normal">
            Name
          </th>
          <th class="hidden px-3 font-normal sm:table-cell">
            Generator
          </th>
          <th class="px-3 text-center font-normal">
            Posts
          </th>
          <th class="hidden px-3 font-normal md:table-cell">
            Last Updated
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(project, i) in projects"
          :key="project.id"
          class="group cursor-pointer odd:bg-row"
          :data-testid="`project-${project.repo}`"
          @click="navigateTo(`/projects/${project.id}`)"
        >
          <td class="rounded-l-2xl px-3 py-3">
            {{ i + 1 }}
          </td>
          <td class="px-3 py-3">
            <NuxtLink :to="`/projects/${project.id}`" class="flex items-center gap-3 group-hover:underline" @click.stop>
              <UIcon name="i-lucide-github" class="size-5 shrink-0" />
              <span>{{ project.repo }}</span>
              <span class="hidden text-xs text-ink-muted lg:inline">{{ project.owner }}</span>
            </NuxtLink>
          </td>
          <td class="hidden px-3 py-3 sm:table-cell">
            <UBadge color="neutral" variant="outline" class="rounded-full">
              {{ SSG_LABELS[project.ssg] }}
            </UBadge>
          </td>
          <td class="px-3 py-3 text-center">
            {{ project.postCount }}
          </td>
          <td class="hidden rounded-r-2xl px-3 py-3 md:table-cell">
            {{ formatDateTime(project.lastUpdatedAt ?? project.lastSyncedAt) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
