export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      neutral: 'neutral',
      secondary: 'iris',
      error: 'alarm',
    },
    button: {
      slots: { base: 'rounded-xl font-normal' },
    },
    input: {
      slots: { base: 'rounded-2xl' },
    },
    modal: {
      slots: { content: 'rounded-[21px]' },
    },
  },
})
