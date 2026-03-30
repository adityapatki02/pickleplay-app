export type PaymentStatus =
  | 'created'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type WhatsAppMessageType =
  | 'marketing'
  | 'match_reminder'
  | 'delay_notification'
  | 'score_update'
  | 'registration_confirmation'
  | 'advancement'
  | 'custom';

export type WhatsAppMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type NotificationType =
  | 'match_reminder'
  | 'delay'
  | 'score_update'
  | 'advancement'
  | 'registration'
  | 'payment'
  | 'general';

export interface Payment {
  id: string;
  userId: string;
  tournamentId: string;
  registrationId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  refundAmount: number;
  refundReason?: string;
  paymentMethod?: string;
  paidAt?: string;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  tournamentId?: string;
  recipientPhone: string;
  templateName: string;
  templateParams: Record<string, string>;
  type: WhatsAppMessageType;
  status: WhatsAppMessageStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  tournamentId?: string;
  matchId?: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  isRead: boolean;
  sentVia: string[];
  createdAt: string;
}
