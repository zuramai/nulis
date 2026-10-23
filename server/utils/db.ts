import mongoose from 'mongoose'

let connecting: Promise<typeof mongoose> | null = null

export function connectDb(uri: string) {
  if (mongoose.connection.readyState === 1)
    return Promise.resolve(mongoose)
  connecting ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 }).catch((error) => {
    connecting = null
    throw error
  })
  return connecting
}
