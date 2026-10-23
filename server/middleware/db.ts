import { connectDb } from '../utils/db'

/**
 * Make sure MongoDB is connected before any request touches a model. If the startup connection failed
 * (bad credentials, Mongo not up yet), this retries it and surfaces the real error instead of a
 * mongoose "buffering timed out" 10s later.
 */
export default defineEventHandler(async () => {
  try {
    await connectDb(useRuntimeConfig().mongodbUri)
  }
  catch (error) {
    throw createError({ statusCode: 503, statusMessage: `Could not connect to MongoDB: ${(error as Error).message}` })
  }
})
