// Safe to import from browser code: no driver, no Node APIs. Everything the UI
// needs from this package lives here; the other entries pull in drizzle.

/**
 * How a note leaves this package: plain JSON. tRPC serializes results, so the
 * row's numeric id becomes a string and the timestamp stays an ISO string.
 */
export interface Note {
  createdAt: string;
  id: string;
  text: string;
}

export const NOTE_TEXT_MAX_LENGTH = 280;

export const MEMBER_ROLES = ["admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface Member {
  email: string;
  id: string;
  joinedAt: string;
  name: string;
  role: MemberRole;
}

export interface Room {
  archived: boolean;
  capacity: number;
  id: string;
  name: string;
}

export interface Booking {
  attendees: number;
  cancelledAt: string | null;
  createdAt: string;
  endsAt: string;
  id: string;
  memberId: string;
  roomId: string;
  startsAt: string;
  title: string;
}

export interface Task {
  assigneeId: string | null;
  completedAt: string | null;
  createdAt: string;
  createdById: string;
  dueOn: string | null;
  id: string;
  title: string;
}

export interface Announcement {
  authorId: string;
  body: string;
  createdAt: string;
  id: string;
  pinned: boolean;
}

export const MEMBER_NAME_MAX_LENGTH = 80;
export const ROOM_NAME_MAX_LENGTH = 60;
export const ROOM_CAPACITY_MAX = 200;
export const BOOKING_TITLE_MAX_LENGTH = 120;
export const BOOKING_PASSWORD_MIN_LENGTH = 4;
export const BOOKING_PASSWORD_MAX_LENGTH = 20;
export const BOOKING_MIN_MINUTES = 15;
export const BOOKING_MAX_MINUTES = 240;
/** Active bookings one member may start on a single UTC day. */
export const MAX_BOOKINGS_PER_MEMBER_PER_DAY = 3;
export const TASK_TITLE_MAX_LENGTH = 160;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 1000;
