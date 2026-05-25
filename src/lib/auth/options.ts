import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_SECRET;

export const isGoogleAuthConfigured = Boolean(
  googleClientId && googleClientSecret && process.env.NEXTAUTH_SECRET,
);

function getProviders() {
  if (!googleClientId || !googleClientSecret) return [];

  return [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ];
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: getProviders(),
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
};
