import { z } from 'zod'
import { User } from '../../models'

const credentialsSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(64).regex(/^[\w.-]+$/, 'Use letters, numbers, dots, dashes or underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(256),
})

const usernameTaken = () => createError({ statusCode: 409, statusMessage: 'Username is already taken' })

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, credentialsSchema.parse)

  if (await User.exists({ username: body.username }))
    throw usernameTaken()

  const user = await User.create({ username: body.username, passwordHash: await hashPassword(body.password) })
    .catch((error: { code?: number }) => {
      // Lost a race with a concurrent registration for the same name (unique index)
      throw error.code === 11000 ? usernameTaken() : error
    })
  await setUserSession(event, { user: { id: String(user._id), username: user.username } })
  return { ok: true }
})
