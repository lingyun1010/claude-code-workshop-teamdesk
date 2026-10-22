import type { Booking } from "@repo/db/shared";
import BookingCard from "./BookingCard";

interface BookingListProps {
  bookings: readonly Booking[];
  describe: (booking: Booking) => string;
  disabled: boolean;
  emptyText: string;
  onCancel: (bookingId: string, password: string) => Promise<boolean>;
}

export default function BookingList({
  bookings,
  describe,
  disabled,
  emptyText,
  onCancel,
}: BookingListProps) {
  if (bookings.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }
  return (
    <ul className="m-0 list-none space-y-4 p-0">
      {bookings.map((booking) => (
        <BookingCard
          booking={booking}
          detail={describe(booking)}
          disabled={disabled}
          key={booking.id}
          onCancel={onCancel}
        />
      ))}
    </ul>
  );
}
