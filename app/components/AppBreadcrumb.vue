<script setup lang="ts">
defineProps<{
  items: { label: string, to?: string }[]
}>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="mb-1 text-xs">
    <ol class="flex flex-wrap items-center gap-1">
      <li v-for="(item, i) in items" :key="i" class="flex items-center gap-1">
        <span v-if="i > 0" aria-hidden="true" class="text-ink-muted">&gt;</span>
        <NuxtLink v-if="item.to" :to="item.to" class="font-bold text-black hover:underline">
          {{ item.label }}
        </NuxtLink>
        <span v-else class="text-[#5d5d5d]" aria-current="page">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>
