# 💰 Runbook 03: Daily Payment Reconciliation & Audit Procedure

> Automated and manual processes to reconcile platform payments with Razorpay gateway payouts and driver wallets.

---

## 1. Automated Daily Reconciliation Job

The `PaymentReconciliationJob` executes every night at 02:00 AM UTC:

1. Fetches all completed rides from yesterday where `payment.status = 'COMPLETED'`.
2. Downloads settlement data via Razorpay Settlements API (`/v1/settlements`).
3. Compares backend `payment_transaction.amount` with Razorpay capture reports.
4. Identifies 3 types of discrepancies:
   - **Type A (Uncaptured)**: Paid in DB, but missing/failed in Razorpay.
   - **Type B (Unrecorded)**: Captured in Razorpay, but stuck as `PAYMENT_PENDING` in DB.
   - **Type C (Amount Mismatch)**: Razorpay captured amount != DB ride total.

---

## 2. Resolving Discrepancies Manually

### Resolving Type A (Uncaptured):
- Action: Reverse driver wallet credit for the ride and mark payment `PAYMENT_FAILED`.
- Contact rider via support ticket for payment retry.

### Resolving Type B (Unrecorded Webhook):
- Trigger manual settlement endpoint:
  ```bash
  curl -X POST https://api.ridenow.com/api/v1/admin/finance/reconcile/single \
    -H "Authorization: Bearer <ADMIN_JWT>" \
    -H "Content-Type: application/json" \
    -d '{"paymentId": "uuid-here"}'
  ```

---

## 3. Financial Audit Report Generation

Run SQL script to verify ledger balance matches wallet balances:

```sql
SELECT 
    w.driver_id,
    w.balance AS stored_balance,
    COALESCE(SUM(CASE WHEN wt.direction = 'CREDIT' THEN wt.amount ELSE -wt.amount END), 0) AS calculated_ledger_balance,
    (w.balance - COALESCE(SUM(CASE WHEN wt.direction = 'CREDIT' THEN wt.amount ELSE -wt.amount END), 0)) AS variance
FROM driver_wallet w
LEFT JOIN wallet_transaction wt ON w.id = wt.wallet_id
GROUP BY w.driver_id, w.balance
HAVING w.balance != COALESCE(SUM(CASE WHEN wt.direction = 'CREDIT' THEN wt.amount ELSE -wt.amount END), 0);
```

*Variance MUST be 0.00 for all drivers. Any non-zero row requires immediate investigation.*
