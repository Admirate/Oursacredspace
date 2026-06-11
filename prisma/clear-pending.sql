UPDATE bookings
SET status = 'EXPIRED',
    cancelled_at = NOW(),
    cancel_reason = 'Cleared stuck PENDING_PAYMENT (Razorpay auth failure during dev)'
WHERE status = 'PENDING_PAYMENT';
