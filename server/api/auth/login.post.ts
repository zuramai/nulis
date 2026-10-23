import { z } from 'zod'
import { User } from '../../models'

const schema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  const user = await User.findOne({ username: body.username })
  if (!user || !(await verifyPassword(user.passwordHash, body.password)))
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })

  await setUserSession(event, { user: { id: String(user._id), username: user.username } })
  return { ok: true }
})
