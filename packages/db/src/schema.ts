// The tables. `drizzle-kit generate` diffs this file against the last snapshot
// in migrations/, so every change here needs a new migration generated with it.
import { sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Any drizzle SQLite instance, which is what every query function takes. D1
 * (`drizzle-orm/d1`) is async and `bun:sqlite` (`drizzle-orm/bun-sqlite`, used
 * by the tests) is sync; both satisfy this, and awaiting works either way.
 */
export type Database = BaseSQLiteDatabase<"sync" | "async", unknown>;

export const notes = sqliteTable("notes", {
  // ISO 8601 UTC. Text because that is the shape that leaves this package
  // anyway, and it still sorts chronologically.
  createdAt: text("created_at").notNull(),
  // Autoincrement, so the id also orders rows by insertion. Two notes written
  // in the same millisecond still come back in the order they were added, and
  // "newest first" needs no index beyond the primary key.
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
});

export const members = sqliteTable("members", {
  email: text("email").notNull().unique(),
  id: integer("id").primaryKey({ autoIncrement: true }),
  joinedAt: text("joined_at").notNull(),
  name: text("name").notNull(),
  // "admin" | "member". Admins manage rooms and anyone's bookings.
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
});

export const rooms = sqliteTable("rooms", {
  // 0 or 1. An archived room keeps its past bookings but takes no new ones.
  archived: integer("archived").notNull().default(0),
  capacity: integer("capacity").notNull(),
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const bookings = sqliteTable(
  "bookings",
  {
    attendees: integer("attendees").notNull(),
    // Null while the booking stands. Cancelled bookings stay for the history.
    cancelledAt: text("cancelled_at"),
    createdAt: text("created_at").notNull(),
    // ISO 8601 UTC, like every timestamp here. End is exclusive.
    endsAt: text("ends_at").notNull(),
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    // "salt:hash", never the password itself. Null on bookings made before
    // passwords existed; those can be cancelled and moved by anyone.
    passwordHash: text("password_hash"),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id),
    startsAt: text("starts_at").notNull(),
    title: text("title").notNull(),
  },
  (table) => [
    // The last line of defence against two requests booking the same slot at
    // once. The overlap check in the service catches everything else.
    uniqueIndex("bookings_room_start_active")
      .on(table.roomId, table.startsAt)
      .where(sql`${table.cancelledAt} is null`),
    index("bookings_member_start").on(table.memberId, table.startsAt),
  ]
);

export const tasks = sqliteTable("tasks", {
  assigneeId: integer("assignee_id").references(() => members.id),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => members.id),
  // Calendar date, YYYY-MM-DD, no time zone.
  dueOn: text("due_on"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
});

export const announcements = sqliteTable("announcements", {
  authorId: integer("author_id")
    .notNull()
    .references(() => members.id),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
  id: integer("id").primaryKey({ autoIncrement: true }),
  pinned: integer("pinned").notNull().default(0),
});

/**
 * True when `error` is SQLite's UNIQUE constraint failure. Drizzle wraps driver
 * errors, so the message can sit on the error or on its cause.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes("UNIQUE constraint failed")) {
      return true;
    }
    current = current.cause;
  }
  return false;
}
