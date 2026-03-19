import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

export const BCRYPT_ROUNDS = 10
import { db } from '@/lib/db'
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema/auth'
import { activatePendingMemberships } from '@/lib/auth/project-members'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1)

        if (!user || !user.password_hash) return null

        const isValid = await bcrypt.compare(password, user.password_hash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  events: {
    async linkAccount({ user }) {
      // When an OAuth account is linked, clear any temporary password_hash
      // to prevent it from being used as a backdoor (e.g. from invitation flows)
      if (user.id) {
        await db
          .update(users)
          .set({ password_hash: null })
          .where(eq(users.id, user.id))
      }
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
    async signIn({ user, account }) {
      // Credentials provider does its own user lookup - always allow
      if (account?.provider === 'credentials') {
        // Auto-activate any pending project memberships
        if (user.id && user.email) {
          try {
            const count = await activatePendingMemberships(user.id, user.email)
            if (count > 0) console.log(`[auth] Activated ${count} pending membership(s) for ${user.email}`)
          } catch (e) {
            console.error('[auth] Failed to activate pending memberships', e)
          }
        }
        return true
      }

      // For OAuth providers: only allow if user already exists in DB
      if (user.email) {
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email.toLowerCase()))
          .limit(1)
        if (!existing) return false

        // Auto-activate any pending project memberships
        try {
          const count = await activatePendingMemberships(existing.id, user.email)
          if (count > 0) console.log(`[auth] Activated ${count} pending membership(s) for ${user.email}`)
        } catch (e) {
          console.error('[auth] Failed to activate pending memberships', e)
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  trustHost: true,
})
