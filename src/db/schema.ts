import { pgTable, text, timestamp, integer, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // GitHub user ID
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
});

export const repoTags = pgTable("repo_tags", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  repoId: integer("repo_id").notNull(), // GitHub repo ID
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
});

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionRepos = pgTable("collection_repos", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  repoId: integer("repo_id").notNull(), // GitHub repo ID
});
