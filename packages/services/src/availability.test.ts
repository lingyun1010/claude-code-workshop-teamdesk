import { beforeEach, describe, expect, test } from "bun:test";
import { insertBooking } from "@repo/db/bookings";
import {
  type AvailabilityService,
  createAvailabilityService,
} from "./availability.ts";
import { at, createTeam, type Team } from "./fixtures.ts";

let team: Team;
let availability: AvailabilityService;

beforeEach(async () => {
  team = await createTeam();
  availability = createAvailabilityService(team.db);
});

describe("availability service", () => {
  test("a booked room is not free, a touching slot is", async () => {
    await insertBooking(team.db, {
      attendees: 2,
      endsAt: at("10:00"),
      memberId: team.ana.id,
      passwordHash: null,
      roomId: team.bigRoom.id,
      startsAt: at("09:00"),
      title: "Planning",
    });

    const during = await availability.freeRooms({
      endsAt: at("09:45"),
      startsAt: at("09:15"),
    });
    const after = await availability.freeRooms({
      endsAt: at("11:00"),
      startsAt: at("10:00"),
    });

    expect(during.ok && during.rooms.map((r) => r.name)).toEqual(["Bridge"]);
    expect(after.ok && after.rooms.map((r) => r.name)).toEqual([
      "Bridge",
      "Harbour",
    ]);
  });

  test("rooms too small for the group are left out", async () => {
    const result = await availability.freeRooms({
      attendees: 5,
      endsAt: at("10:00"),
      startsAt: at("09:00"),
    });

    expect(result.ok && result.rooms.map((r) => r.name)).toEqual(["Harbour"]);
  });

  test("an inverted slot is an error", async () => {
    const result = await availability.freeRooms({
      endsAt: at("09:00"),
      startsAt: at("10:00"),
    });

    expect(result.ok).toBe(false);
  });
});
