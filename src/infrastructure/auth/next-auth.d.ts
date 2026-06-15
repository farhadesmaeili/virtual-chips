import { type DefaultSession } from 'next-auth';

// Augment NextAuth's types so our custom fields (id, username) are typed on
// the session and the JWT.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
  }
}
