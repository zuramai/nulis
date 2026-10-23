import { z } from 'zod'
import { User } from '../../models'

const credentialsSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(64).regex(/^[\w.-]+$/, 'Use letters, numbers, dots, dashes or underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(256),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, credentialsSchema.parse)

  // Nulis is single-owner: registration closes once the first account exists.
  if (await User.exists({}))
    throw createError({ statusCode: 403, statusMessage: 'Registration is closed' })

  const user = await User.create({ username: body.username, passwordHash: await hashPassword(body.password) })
  await setUserSession(event, { user: { id: String(user._id), username: user.username } })
  return { ok: true }
})
