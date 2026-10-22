import {
  createBookingInput,
  rescheduleBookingInput,
} from "@repo/services/bookings";
import { z } from "zod";
import { publicProcedure, router } from "../init.ts";

export const bookingsRouter = router({
  cancel: publicProcedure
    .input(
      z.object({
        actorId: z.string(),
        bookingId: z.string(),
        password: z.string(),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.services.bookings.cancel(
        input.actorId,
        input.bookingId,
        input.password
      )
    ),
  create: publicProcedure
    .input(z.object({ actorId: z.string(), booking: createBookingInput }))
    .mutation(({ ctx, input }) =>
      ctx.services.bookings.create(input.actorId, input.booking)
    ),
  forRoom: publicProcedure
    .input(z.object({ day: z.iso.datetime(), roomId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.services.bookings.listForRoom(input.roomId, input.day)
    ),
  reschedule: publicProcedure
    .input(
      z.object({
        actorId: z.string(),
        bookingId: z.string(),
        password: z.string(),
        slot: rescheduleBookingInput,
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.services.bookings.reschedule(
        input.actorId,
        input.bookingId,
        input.password,
        input.slot
      )
    ),
  upcoming: publicProcedure
    .input(z.object({ memberId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.services.bookings.listUpcoming(
        input.memberId,
        new Date().toISOString()
      )
    ),
});
