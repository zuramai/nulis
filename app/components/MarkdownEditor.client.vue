<script setup lang="ts">
import { Crepe } from '@milkdown/crepe'
import { imageBlockSchema } from '@milkdown/kit/component/image-block'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

const props = defineProps<{
  projectId: string
  /** Repo path of the document; relative image paths resolve against it */
  contentPath: string
}>()
const emit = defineEmits<{
  /** An image was staged; its id must be sent along with the next save */
  uploaded: [assetId: string]
  ready: []
}>()
const markdown = defineModel<string>({ required: true })

const root = ref<HTMLDivElement>()
let crepe: Crepe | null = null
const toast = useToast()

/**
 * Crepe's image block stores its resize ratio in the alt text (`![1.00](src "caption")`).
 * SSG content uses the alt text as the caption, so read and write `![caption](src)` instead.
 */
const captionAsAlt = imageBlockSchema.extendSchema(prev => (ctx) => {
  const base = prev(ctx)
  return {
    ...base,
    parseMarkdown: {
      match: base.parseMarkdown.match,
      runner: (state, node, type) => {
        state.addNode(type, { src: node.url as string, caption: (node.alt as string | null) ?? (node.title as string | null) ?? '', ratio: 1 })
      },
    },
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state, node) => {
        state.openNode('paragraph')
        state.addNode('image', undefined, undefined, { url: node.attrs.src, alt: node.attrs.caption || '', title: null })
        state.closeNode()
      },
    },
  }
})

/** Relative image sources are served through the API so private repos and staged uploads preview. */
function previewUrl(src: string) {
  if (!src || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src))
    return src
  const query = new URLSearchParams({ from: props.contentPath, src })
  return `/api/projects/${props.projectId}/raw?${query}`
}

async function upload(file: File) {
  const form = new FormData()
  form.append('file', file)
  form.append('contentPath', props.contentPath)
  try {
    const asset = await $fetch<{ id: string, src: string }>(`/api/projects/${props.projectId}/assets`, { method: 'POST', body: form })
    emit('uploaded', asset.id)
    return asset.src
  }
  catch (e) {
    toast.add({ title: 'Upload failed', description: errorMessage(e), color: 'error' })
    throw e
  }
}

onMounted(async () => {
  crepe = new Crepe({
    root: root.value,
    defaultValue: markdown.value,
    features: {
      [Crepe.Feature.TopBar]: true,
      [Crepe.Feature.Latex]: false,
      [Crepe.Feature.AI]: false,
    },
    featureConfigs: {
      [Crepe.Feature.ImageBlock]: {
        onUpload: upload,
        proxyDomURL: previewUrl,
        blockUploadButton: 'Upload Image',
        inlineUploadButton: 'Upload Image',
        blockCaptionPlaceholderText: 'Write a caption (used as alt text)…',
      },
      [Crepe.Feature.Placeholder]: { text: 'Start writing…', mode: 'doc' },
    },
  })
  crepe.editor.use(captionAsAlt)
  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, next) => {
      markdown.value = next
    })
  })
  await crepe.create()
  emit('ready')
})

onBeforeUnmount(() => {
  crepe?.destroy()
  crepe = null
})

defineExpose({
  /** The serialized markdown, normalized by the editor */
  getMarkdown: () => crepe?.getMarkdown() ?? markdown.value,
})
</script>

<template>
  <div class="nulis-editor overflow-hidden rounded-2xl border border-black" data-testid="editor">
    <div ref="root" />
  </div>
</template>
