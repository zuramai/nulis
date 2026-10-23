import { connectDb } from '../utils/db'

export default defineNitroPlugin(async () => {
  const { mongodbUri } = useRuntimeConfig()
  try {
    await connectDb(mongodbUri)
  }
  catch (error) {
    console.error('[nulis] Could not connect to MongoDB:', (error as Error).message)
  }
})
