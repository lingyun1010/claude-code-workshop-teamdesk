import type { Booking } from "@repo/db/shared";
import { type FormEvent, useCallback, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { formatUtcRange } from "#/lib/datetime";

interface BookingCardProps {
  booking: Booking;
  /** Who booked it or where it is, depending on the list. */
  detail: string;
  disabled: boolean;
  onCancel: (bookingId: string, password: string) => Promise<boolean>;
}

export default function BookingCard({
  booking,
  detail,
  disabled,
  onCancel,
}: BookingCardProps) {
  const [asking, setAsking] = useState(false);

  const handleAsk = useCallback(() => setAsking(true), []);
  const handleBack = useCallback(() => setAsking(false), []);
  const handleCancel = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const password = String(
        new FormData(event.currentTarget).get("password") ?? ""
      );
      if (await onCancel(booking.id, password)) {
        setAsking(false);
      }
    },
    [booking.id, onCancel]
  );

  return (
    <li className="flex items-center justify-between gap-4 border-border border-t pt-4">
      <div>
        <p className="m-0 font-semibold text-foreground">{booking.title}</p>
        <p className="m-0 text-muted-foreground text-sm">
          <time dateTime={booking.startsAt}>
            {formatUtcRange(booking.startsAt, booking.endsAt)}
          </time>
          , {detail}, {booking.attendees}{" "}
          {booking.attendees === 1 ? "person" : "people"}
        </p>
      </div>
      {asking ? (
        <form className="flex items-center gap-2" onSubmit={handleCancel}>
          <Input
            aria-label="Booking password"
            autoComplete="off"
            className="w-32"
            name="password"
            placeholder="Password"
          />
          <Button disabled={disabled} size="sm" type="submit">
            Confirm
          </Button>
          <Button onClick={handleBack} size="sm" type="button" variant="ghost">
            Back
          </Button>
        </form>
      ) : (
        <Button
          disabled={disabled}
          onClick={handleAsk}
          size="sm"
          variant="outline"
        >
          Cancel
        </Button>
      )}
    </li>
  );
}
