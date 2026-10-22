import { and, asc, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { bookings, type Database } from "./schema.ts";
import type { Booking } from "./shared.ts";

type BookingRow = typeof bookings.$inferSelect;

function toBooking(row: BookingRow): Booking {
  return {
    attendees: row.attendees,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    endsAt: row.endsAt,
    id: String(row.id),
    memberId: String(row.memberId),
    roomId: String(row.roomId),
    startsAt: row.startsAt,
    title: row.title,
  };
}

export async function getBooking(
  db: Database,
  id: string
): Promise<Booking | null> {
  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, Number(id)))
    .limit(1);
  return row ? toBooking(row) : null;
}

/**
 * The stored "salt:hash" for a booking, or null for one made before passwords
 * existed. Kept out of `Booking` so it never reaches the browser.
 */
export async function getBookingPasswordHash(
  db: Database,
  id: string
): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: bookings.passwordHash })
    .from(bookings)
    .where(eq(bookings.id, Number(id)))
    .limit(1);
  return row?.passwordHash ?? null;
}

/** Active bookings of a room that start in [from, to), earliest first. */
export async function listRoomBookings(
  db: Database,
  roomId: string,
  range: { from: string; to: string }
): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, Number(roomId)),
        isNull(bookings.cancelledAt),
        lt(bookings.startsAt, range.to),
        gt(bookings.endsAt, range.from)
      )
    )
    .orderBy(asc(bookings.startsAt));
  return rows.map(toBooking);
}

/** A member's active bookings that end after `from`, earliest first. */
export async function listMemberBookings(
  db: Database,
  memberId: string,
  from: string
): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.memberId, Number(memberId)),
        isNull(bookings.cancelledAt),
        gt(bookings.endsAt, from)
      )
    )
    .orderBy(asc(bookings.startsAt));
  return rows.map(toBooking);
}

/**
 * Active bookings in the room that overlap [startsAt, endsAt). Ends are
 * exclusive, so a booking ending at 10:00 does not overlap one starting then.
 */
export async function findOverlappingBookings(
  db: Database,
  input: {
    endsAt: string;
    excludeId?: string;
    roomId: string;
    startsAt: string;
  }
): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, Number(input.roomId)),
        isNull(bookings.cancelledAt),
        lt(bookings.startsAt, input.endsAt),
        gt(bookings.endsAt, input.startsAt),
        input.excludeId ? ne(bookings.id, Number(input.excludeId)) : undefined
      )
    );
  return rows.map(toBooking);
}

export async function insertBooking(
  db: Database,
  input: {
    attendees: number;
    endsAt: string;
    memberId: string;
    passwordHash: string | null;
    roomId: string;
    startsAt: string;
    title: string;
  }
): Promise<Booking> {
  const [row] = await db
    .insert(bookings)
    .values({
      ...input,
      createdAt: new Date().toISOString(),
      memberId: Number(input.memberId),
      roomId: Number(input.roomId),
    })
    .returning();
  if (!row) {
    throw new Error("Booking was inserted but could not be read back.");
  }
  return toBooking(row);
}

export async function updateBookingTimes(
  db: Database,
  id: string,
  times: { endsAt: string; startsAt: string }
): Promise<Booking | null> {
  const [row] = await db
    .update(bookings)
    .set(times)
    .where(eq(bookings.id, Number(id)))
    .returning();
  return row ? toBooking(row) : null;
}

export async function cancelBooking(
  db: Database,
  id: string
): Promise<Booking | null> {
  const [row] = await db
    .update(bookings)
    .set({ cancelledAt: new Date().toISOString() })
    .where(and(eq(bookings.id, Number(id)), isNull(bookings.cancelledAt)))
    .returning();
  return row ? toBooking(row) : null;
}
