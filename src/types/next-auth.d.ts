import type { DefaultSession } from "next-auth";

interface GoClawAuthUser {
  id: string;
  provider: string;
  provider_id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

interface GoClawAuthTenant {
  id: string;
  slug: string;
  role: string;
}

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
    };
    goclawAccessToken?: string;
    goclawExpiresAt?: string;
    goclawUser?: GoClawAuthUser;
    goclawTenant?: GoClawAuthTenant;
    goclawAuthError?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    goclawAccessToken?: string;
    goclawExpiresAt?: string;
    goclawUser?: GoClawAuthUser;
    goclawTenant?: GoClawAuthTenant;
    goclawAuthError?: string;
  }
}
