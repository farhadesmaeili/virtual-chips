import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../persistence/prisma';
import { PrismaUserRepository } from '../persistence/prisma-user-repository';
import { verifyCredentials } from './credentials';

const userRepository = new PrismaUserRepository(prisma);

/**
 * NextAuth configuration. Uses the JWT session strategy because the
 * Credentials provider requires it (database sessions are not supported for
 * credential logins). The secret is read only on the server from the
 * environment and never shipped to the client.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const user = await verifyCredentials(credentials, (email) =>
          userRepository.findCredentialByEmail(email),
        );
        // Return null on any failure → NextAuth surfaces a single generic
        // error, so we never reveal which field was wrong.
        if (user === null) return null;
        return { id: user.id, email: user.email, name: user.username };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.name ?? '';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    },
  },
};
