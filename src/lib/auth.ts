import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      authorization: {
        params: {
          scope: "read:user",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github") {
        try {
          await db.execute({
            sql: `INSERT INTO users (id, username, avatar_url) VALUES (?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET username = ?, avatar_url = ?`,
            args: [
              account.providerAccountId,
              (profile as { login?: string })?.login ?? "",
              user.image ?? null,
              (profile as { login?: string })?.login ?? "",
              user.image ?? null,
            ],
          });
        } catch (error) {
          console.error("Failed to upsert user:", error);
        }
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.githubId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.githubId = token.githubId as string;
      return session;
    },
  },
});
