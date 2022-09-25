import { Event, Profile, User } from '@prisma/client'
import { client } from '..'
import { AuthResponse, Request } from '../types/types'
import { getGoogleUser } from '../services/googleUser'
import { IGoogleUser } from '../types/auth'
import jwt from 'jsonwebtoken'

function makeToken (user: User) {
  const token = jwt.sign({ _id: user.id, }, process.env.TOKEN_SECRET)

  return token
}

async function createUser (googleUser: IGoogleUser) {
  const user = await client.user.create({
    data: {
      authKey: googleUser.sub,
      authMethod: 'google',
      email: googleUser.email,
      profile: {
        create: {
          name: googleUser.given_name,
          picture: googleUser.picture
        }
      }
    }
  })

  return user
}

const unauthController = {
  accessToken: async (
    req: Request<{ accessToken: string }>,
    res: AuthResponse<{data: { user: User, token: string, profile: Profile }} >
  ) => {
    const { accessToken } = req.body
    const googleUser = await getGoogleUser(accessToken)

    try {
      const systemUser = await client.user.findUnique({ where: {
        email: googleUser.email
      }})

      const user = systemUser || await createUser(googleUser)
      const profile = await client.profile.findFirst({
        where: { id: user.id }
      })
      const token = makeToken(user)

      res.cookie('bearer-token', token)
      res.cookie('user-id', user.id)

      res.status(200).send({
        data: {
          user,
          profile,
          token
        }
      })
    } catch (err) {
      console.log(err)
      res.status(400).json(err)
    }
  },
}

export default unauthController
