import NextAuth from "next-auth"; // For Auth.js v5, you still import from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import type { NextAuthOptions } from "next-auth"; // New type for configuration

interface GitHubProfile {
  id: number | string;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  // add any more GitHub profile fields you use
}

// Parse ADMIN_EMAILS from environment variable
const ADMIN_EMAILS: string[] = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.toLowerCase().split(',').map(email => email.trim())
  : [];

// Parse ADMIN_GITHUB_USERNAMES from environment variable
const ADMIN_GITHUB_USERNAMES: string[] = process.env.ADMIN_GITHUB_USERNAMES
  ? process.env.ADMIN_GITHUB_USERNAMES.toLowerCase().split(',').map(username => username.trim())
  : [];

// Define your authentication configuration
export const authConfig: NextAuthOptions = {
  // Use `pages` to redirect to your custom sign-in/error pages
  pages: {
    signIn: '/admin', // Redirects to this page if not authenticated
    error: '/auth/error', // Custom error page
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      profile(profile: GitHubProfile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email, // GitHub email might be null if private
          image: profile.avatar_url,
          // Add GitHub username directly to the user object that gets passed to callbacks
          githubUsername: profile.login,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    // The signIn callback is crucial for restricting access to admin users
    async signIn({ user, account, profile }) {
      if (!user || !account) {
        console.warn(`[AUTH] Login attempt rejected: Missing user or account data.`);
        return false;
      }

      // Logic for Google provider (using email)
      if (account.provider === 'google') {
        if (user.email) {
          const userEmail = user.email.toLowerCase();
          if (ADMIN_EMAILS.includes(userEmail)) {
            console.log(`[AUTH] Admin User (Google) '${userEmail}' signed in successfully.`);
            return true; // Allow sign-in
          } else {
            console.warn(`[AUTH] Unauthorized login attempt (Google) by non-admin: '${userEmail}'.`);
            return '/auth/error?reason=unauthorized_email'; // Redirect to error page
          }
        }
        console.warn(`[AUTH] Login attempt (Google) rejected: No email provided for user:`, user);
        return false; // Reject if Google doesn't provide email
      }

      // Logic for GitHub provider (using username)
      if (account.provider === 'github') {
        // user.githubUsername comes from the `profile` callback above
        const githubUsername = (user as any).githubUsername?.toLowerCase();
        if (githubUsername) {
          if (ADMIN_GITHUB_USERNAMES.includes(githubUsername)) {
            console.log(`[AUTH] Admin User (GitHub) '${githubUsername}' signed in successfully.`);
            return true; // Allow sign-in
          } else {
            console.warn(`[AUTH] Unauthorized login attempt (GitHub) by non-admin: '${githubUsername}'.`);
            return '/auth/error?reason=unauthorized_username'; // Redirect to error page
          }
        }
        console.warn(`[AUTH] Login attempt (GitHub) rejected: No username found in profile for user:`, user);
        return false; // Reject if GitHub username not available
      }

      // Fallback for any other unexpected providers or missing data
      console.warn(`[AUTH] Login attempt rejected: Unknown provider or missing user data. User:`, user, 'Account:', account);
      return false;
    },

    // Extend the JWT and session with provider info or custom data if needed
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
        if (account.id_token) token.id_token = account.id_token; // For Google
      }
      // Add GitHub username to JWT if applicable
      if (account?.provider === 'github' && user && (user as any).githubUsername) {
          token.githubUsername = (user as any).githubUsername;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose custom data from JWT to the client-side session
      if (token) {
        session.accessToken = token.accessToken as string;
        session.provider = token.provider as string;
        if (token.githubUsername) { // Expose GitHub username to session
          session.user = { ...session.user, githubUsername: token.githubUsername };
        }
      }
      return session;
    },
  },
  // A secret is required for JWT encryption and hash signing
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === 'development',
} satisfies NextAuthOptions; // Use satisfies to ensure it conforms to NextAuthConfig

// This is the crucial part for Auth.js v5:
// NextAuth returns an object with `handlers`, `auth`, `signIn`, `signOut`.
// We destructure `handlers` to get `GET` and `POST` and export them.
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export const { GET, POST } = handlers; // <--- This line is key!


// Extend the Session and JWT types to include custom properties
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    provider?: string;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubUsername?: string; // Add this for GitHub users
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    provider?: string;
    id_token?: string;
    githubUsername?: string; // Add this for GitHub users
  }
}