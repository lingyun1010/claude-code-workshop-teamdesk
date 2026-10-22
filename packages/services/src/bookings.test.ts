import { beforeEach, describe, expect, test } from "bun:test";
import { insertBooking } from "@repo/db/bookings";
import { BOOKING_MAX_MINUTES } from "@repo/db/shared";
import { type BookingsService, createBookingsService } from "./bookings.ts";
import { at, createTeam, type Team } from "./fixtures.ts";

const LEAK = /Blue7|password/i;

let team: Team;
let bookings: BookingsService;

beforeEach(async () => {
  team = await createTeam();
  bookings = createBookingsService(team.db);
});

const standUp = (
  roomId: string,
  startsAt = at("09:00"),
  endsAt = at("09:30")
) => ({
  attendees: 2,
  endsAt,
  password: "Blue7",
  roomId,
  startsAt,
  title: "Stand-up",
});

describe("bookings service", () => {
  test("create stores the booking for the acting member", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    expect(booking).toMatchObject({
      memberId: team.ana.id,
      roomId: team.bigRoom.id,
    });
    expect(await bookings.listForRoom(team.bigRoom.id, at("00:00"))).toEqual([
      booking,
    ]);
  });

  test("create refuses an overlapping slot but allows a touching one", async () => {
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("09:00"), at("10:00"))
    );

    await expect(
      bookings.create(
        team.ben.id,
        standUp(team.bigRoom.id, at("09:30"), at("10:30"))
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await bookings.create(
      team.ben.id,
      standUp(team.bigRoom.id, at("10:00"), at("10:30"))
    );
  });

  test("create checks the room's capacity", async () => {
    await expect(
      bookings.create(team.ana.id, {
        ...standUp(team.smallRoom.id),
        attendees: 3,
      })
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  test("create enforces the minimum and maximum length", async () => {
    await expect(
      bookings.create(
        team.ana.id,
        standUp(team.bigRoom.id, at("09:00"), at("09:10"))
      )
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const tooLong = new Date(
      Date.parse(at("09:00")) + (BOOKING_MAX_MINUTES + 1) * 60_000
    );
    await expect(
      bookings.create(
        team.ana.id,
        standUp(team.bigRoom.id, at("09:00"), tooLong.toISOString())
      )
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  test("create rejects an unknown room", async () => {
    await expect(
      bookings.create(team.ana.id, standUp("999"))
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("create needs a password of 4 to 20 characters", async () => {
    const attempt = (password: string) =>
      expect(
        bookings.create(team.ana.id, { ...standUp(team.bigRoom.id), password })
      ).rejects.toThrow();
    await Promise.all([attempt(""), attempt("abc"), attempt("x".repeat(21))]);
  });

  test("cancel needs the exact password, from anyone", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    const refused = (actor: string, password: string) =>
      expect(
        bookings.cancel(actor, booking.id, password)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await Promise.all([
      refused(team.ana.id, "wrong"),
      refused(team.ana.id, "blue7"),
      refused(team.ana.id, ""),
      refused(team.ben.id, "blue7"),
      refused(team.admin.id, "nope"),
    ]);
    expect(
      (await bookings.cancel(team.ben.id, booking.id, "Blue7")).cancelledAt
    ).not.toBeNull();
    expect(await bookings.listUpcoming(team.ana.id, at("00:00"))).toEqual([]);
  });

  test("reschedule needs the exact password", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );
    const slot = { endsAt: at("11:30"), startsAt: at("11:00") };

    await expect(
      bookings.reschedule(team.admin.id, booking.id, "blue7", slot)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      await bookings.reschedule(team.ben.id, booking.id, "Blue7", slot)
    ).toMatchObject(slot);
  });

  test("a booking from before passwords existed needs none", async () => {
    const booking = await insertBooking(team.db, {
      attendees: 2,
      endsAt: at("09:30"),
      memberId: team.ana.id,
      passwordHash: null,
      roomId: team.bigRoom.id,
      startsAt: at("09:00"),
      title: "Old booking",
    });

    expect(
      (await bookings.cancel(team.ben.id, booking.id, "")).cancelledAt
    ).not.toBeNull();
  });

  test("the password and its hash never appear on a booking", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );
    const listed = await bookings.listForRoom(team.bigRoom.id, at("00:00"));

    for (const result of [booking, ...listed]) {
      expect(JSON.stringify(result)).not.toMatch(LEAK);
    }
  });

  test("reschedule moves a booking within the same room", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    const moved = await bookings.reschedule(team.ana.id, booking.id, "Blue7", {
      endsAt: at("11:30"),
      startsAt: at("11:00"),
    });

    expect(moved).toMatchObject({ endsAt: at("11:30"), startsAt: at("11:00") });
  });

  test("reschedule refuses a slot that clashes with another booking", async () => {
    await bookings.create(
      team.ben.id,
      standUp(team.bigRoom.id, at("11:00"), at("12:00"))
    );
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    await expect(
      bookings.reschedule(team.ana.id, booking.id, "Blue7", {
        endsAt: at("11:45"),
        startsAt: at("11:15"),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("bookings on another day do not count towards the daily limit", async () => {
    const nextDay = (time: string) =>
      at(time).replace("2026-10-23", "2026-10-24");
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("09:00"), at("09:30"))
    );
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("10:00"), at("10:30"))
    );
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("11:00"), at("11:30"))
    );

    const tomorrow = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, nextDay("09:00"), nextDay("09:30"))
    );

    expect(tomorrow.startsAt).toBe(nextDay("09:00"));
  });
});
