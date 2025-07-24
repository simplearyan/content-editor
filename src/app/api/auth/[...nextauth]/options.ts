// /app/api/auth/[...nextauth]/options.ts
import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

const adminUsernames = process.env.ADMIN_GITHUB_USERNAMES?.split(',').map(name => name.trim()) || [];

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
        const githubProfile = profile as { login?: string }; // minimal typing for your use case
      if (githubProfile?.login && adminUsernames.includes(githubProfile.login)) {
        console.log(`Admin user '${githubProfile.login}' signed in.`);
        return true;
      } else {
        console.warn(`Non-admin user '${githubProfile?.login}' attempted to sign in.`);
        return '/unauthorized';
      }
    },
    async jwt({ token, user, account, profile }) {
        const githubProfile = profile as { login?: string };
      if (githubProfile?.login) {
        token.isAdmin = adminUsernames.includes(githubProfile.login);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.isAdmin) {
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth-error',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
