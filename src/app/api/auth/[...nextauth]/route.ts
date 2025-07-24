// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
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
      // Check if the signing-in user is in our admin list
      if (profile?.login && adminUsernames.includes(profile.login)) {
        console.log(`Admin user '${profile.login}' signed in.`);
        return true; // Allow sign in
      } else {
        console.warn(`Non-admin user '${profile?.login}' attempted to sign in.`);
        return '/unauthorized'; // Redirect unauthorized users
      }
    },
    async jwt({ token, user, account, profile }) {
      // Add admin status to JWT
      if (profile?.login) {
        token.isAdmin = adminUsernames.includes(profile.login);
      }
      return token;
    },
    async session({ session, token }) {
      // Add admin status to session
      if (token.isAdmin) {
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login', // Custom sign-in page (optional)
    error: '/auth-error', // Custom error page (optional)
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };