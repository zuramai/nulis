export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },

  app: {
    head: {
      title: 'Nulis',
      meta: [{ name: 'description', content: 'Content editor for your static sites' }],
    },
  },

  runtimeConfig: {
    mongodbUri: 'mongodb://127.0.0.1:27017/nulis',
    // 32+ character secret used to encrypt GitHub tokens at rest
    encryptionKey: '',
    // Use the in-memory git provider (tests / demos)
    fakeGit: false,
    oauth: {
      github: {
        clientId: '',
        clientSecret: '',
        scope: ['repo', 'read:user'],
      },
    },
  },

  ui: {
    theme: { colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error'] },
    // The design is black on white only; with color mode on, a dark OS theme adds `.dark` and turns
    // the inverted text on black buttons black too.
    colorMode: false,
  },

  icon: {
    serverBundle: { collections: ['lucide'] },
  },

  fonts: {
    families: [{ name: 'Roboto Serif', provider: 'google', weights: [400, 500, 600, 700] }],
  },
})
