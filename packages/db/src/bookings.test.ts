import { beforeEach, describe, expect, test } from "bun:test";
import {
  cancelBooking,
  findOverlappingBookings,
  getBooking,
  insertBooking,
  listMemberBookings,
  listRoomBookings,
  updateBookingTimes,
} from "./bookings.ts";
import { createMember } from "./members.ts";
import { insertRoom } from "./rooms.ts";
import { type Database, isUniqueViolation } from "./schema.ts";
import { createTestDatabase } from "./testing.ts";

let db: Database;
let memberId: string;
let roomId: string;

const at = (time: string) => `2026-10-23T${time}:00.000Z`;

beforeEach(async () => {
  db = createTestDatabase();
  memberId = (
    await createMember(db, {
      email: "ana@example.com",
      name: "Ana",
      role: "member",
    })
  ).id;
  roomId = (await insertRoom(db, "Harbour", 8)).id;
});

const book = (startsAt: string, endsAt: string) =>
  insertBooking(db, {
    attendees: 2,
    endsAt,
    memberId,
    passwordHash: null,
    roomId,
    startsAt,
    title: "Stand-up",
  });

describe("bookings", () => {
  test("insertBooking stores ids as strings", async () => {
    const booking = await book(at("09:00"), at("09:30"));

    expect(booking).toMatchObject({ cancelledAt: null, memberId, roomId });
    expect(await getBooking(db, booking.id)).toEqual(booking);
  });

  test("findOverlappingBookings treats ends as exclusive", async () => {
    const first = await book(at("09:00"), at("10:00"));

    const touching = await findOverlappingBookings(db, {
      endsAt: at("11:00"),
      roomId,
      startsAt: at("10:00"),
    });
    const overlapping = await findOverlappingBookings(db, {
      endsAt: at("10:30"),
      roomId,
      startsAt: at("09:30"),
    });

    expect(touching).toEqual([]);
    expect(overlapping.map((b) => b.id)).toEqual([first.id]);
  });

  test("findOverlappingBookings can skip the booking being moved", async () => {
    const first = await book(at("09:00"), at("10:00"));

    const others = await findOverlappingBookings(db, {
      endsAt: at("10:30"),
      excludeId: first.id,
      roomId,
      startsAt: at("09:30"),
    });

    expect(others).toEqual([]);
  });

  test("cancelled bookings drop out of lists and free the slot", async () => {
    const first = await book(at("09:00"), at("10:00"));

    expect((await cancelBooking(db, first.id))?.cancelledAt).not.toBeNull();
    expect(await cancelBooking(db, first.id)).toBeNull();
    expect(
      await listRoomBookings(db, roomId, { from: at("00:00"), to: at("23:59") })
    ).toEqual([]);
    expect(await listMemberBookings(db, memberId, at("00:00"))).toEqual([]);
    await book(at("09:00"), at("10:00"));
  });

  test("two active bookings cannot start at the same time in one room", async () => {
    await book(at("09:00"), at("10:00"));

    let error: unknown;
    try {
      await book(at("09:00"), at("09:30"));
    } catch (err) {
      error = err;
    }

    expect(isUniqueViolation(error)).toBe(true);
  });

  test("updateBookingTimes moves a booking", async () => {
    const first = await book(at("09:00"), at("10:00"));

    const moved = await updateBookingTimes(db, first.id, {
      endsAt: at("12:00"),
      startsAt: at("11:00"),
    });

    expect(moved).toMatchObject({ endsAt: at("12:00"), startsAt: at("11:00") });
  });
});
