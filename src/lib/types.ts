// Shapes of the admin API replies this app reads (backend: routes/admin/*). Only the fields screens use.
export type Person = { _id: string; firstName?: string; lastName?: string; email?: string; phone?: string; countryCode?: string };

export type Booking = {
  _id: string;
  bookingId: string;
  serviceName: string;
  scheduledDate: string;
  selectedSlot: string;
  endTime?: string;
  timeInterval?: string;
  price: number;
  vendorPriceAfterDetection?: number;
  checkoutRefundAmount?: number; // unused hours paid back at check-out
  checkoutRefundStatus?: string | null;
  commissionAmount?: number;
  taxAmount?: number;
  cancelledBy?: "customer" | "provider" | "system" | null;
  cancelReason?: string | null;
  serviceProvider?: Person;
  userDetails?: Person;
  status?: number; // not in list rows; the list query sets it
};

export type Buddy = Person & {
  postalCode?: string;
  address?: { street?: string; city?: string; state?: string };
  IdProofFront?: string | null;
  IdProofBack?: string | null;
  certificate?: string | null;
  additionalDoc?: string | null;
  isActive?: number;
  verificationStatus?: 0 | 1 | 2;
  payoutAccountStatus?: "not_started" | "pending" | "needs_info" | "verified" | "disabled";
  createdAt?: string;
};

export type Summary = {
  totalCustomers: number; totalBookings: number; totalCancelled: number; totalCompleted: number;
  comparisons: { totalCustomers: number; totalBookings: number; totalCancelled: number; totalCompleted: number };
};
export type Graph = { filterType: string; labels: string[]; averageOverallAppointment: number[]; averagePerAppointment: number[] };
