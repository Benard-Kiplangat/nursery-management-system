# System Design Improvement Roadmap

This document captures recommendations for improving performance, scalability, reliability, security, and maintainability.

## Current architecture

The application currently includes:

- React and Vite frontend
- Browser PouchDB in `src/db.js`
- Express server
- Electron SQLite support
- M-PESA and eTIMS integrations

The most important architectural decision is to define a clear source of truth. A recommended target architecture is:

```text
React UI
   ↓
Application service/API layer
   ↓
Server database
   ↓
Integration workers
```

Use local PouchDB as an offline cache or queue rather than as a second independent business database.

Document clearly:

- Which layer owns inventory
- Which layer owns sales
- Which layer owns authentication
- How offline changes synchronize
- What happens when two devices sell from the same batch

## 1. Improve data access performance

Avoid repeatedly using `db.allDocs({ include_docs: true })` and filtering the entire database in JavaScript. This becomes slow as the number of sales and batches grows.

Create indexes for common queries:

- `type`
- `type + cropId + quantityRemaining`
- `type + timestamp`
- `type + customerName`
- `type + batchId`
- `type + presaleStatus`

Query only relevant records and load active presale reservations once instead of recalculating them for every product.

## 2. Make inventory updates transactional

Inventory deduction and sale creation must be treated as one logical operation:

```text
Read latest stock
Verify sufficient quantity
Deduct quantity
Record sale
Commit both changes
```

Separate writes can leave inventory and sales inconsistent if the application crashes between them.

Prefer a server database transaction:

```sql
BEGIN;
UPDATE batches
SET quantity_remaining = quantity_remaining - ?
WHERE id = ?
  AND quantity_remaining >= ?;

INSERT INTO sales (...);
COMMIT;
```

For PouchDB, use a sale-intent or operation queue with unique operation IDs.

## 3. Handle concurrent sales safely

Two devices may try to sell the last units from a batch. Use:

- Revision and conflict handling for PouchDB
- Atomic conditional updates on the server
- Retry logic for conflicts
- Clear feedback when stock changes
- Server-side validation

Never rely only on quantities held in React state.

## 4. Introduce a service layer

Separate UI components, React hooks, business services, and data access:

```text
UI components
  → React hooks
    → application services
      → repositories/data access
```

Suggested structure:

```text
src/
  domain/
    sales/
      calculateSaleTotal.js
      validateSale.js
  services/
    saleService.js
    inventoryService.js
  repositories/
    batchRepository.js
    saleRepository.js
```

The UI should not directly decide how inventory is deducted or how a sale is persisted.

## 5. Use one canonical sale calculation

Create one shared calculation for product cards, cart totals, receipts, database records, and tax integrations:

```js
export function calculateLineTotal({ quantity, unitPrice, discountAmount = 0 }) {
  const subtotal = quantity * unitPrice;
  const discount = Math.min(subtotal, Math.max(0, discountAmount));

  return {
    subtotal,
    discount,
    total: subtotal - discount
  };
}
```

This prevents different parts of the system from calculating different totals.

## 6. Add durable synchronization

Create an offline outbox with fields such as:

```text
id
operation_type
payload
status
retry_count
last_error
created_at
```

When offline:

1. Save the operation locally.
2. Display a pending-sync status.
3. Retry with exponential backoff.
4. Mark it complete only after server confirmation.
5. Keep failed operations visible for resolution.

Do not silently ignore synchronization errors.

## 7. Improve reliability and observability

Add:

- Structured server logs
- Request IDs
- Operation IDs for sales
- Error categories
- Retry counts
- A `/health` endpoint
- Integration status tracking
- Backup verification
- Audit logs for stock changes, discounts, deletions, and readiness overrides

Important failures should be persisted or sent to a monitoring system instead of only being printed to the console.

## 8. Secure the server and integrations

Important security controls include:

- Keep M-PESA and eTIMS credentials server-side
- Validate every request on the server
- Enforce permissions server-side
- Use modern password hashing
- Rate-limit login and payment endpoints
- Validate discount permissions
- Restrict batch deletion and readiness overrides
- Use HTTPS in production
- Avoid logging tokens or sensitive customer data

The frontend must not be treated as a trusted security boundary.

## 9. Improve database structure

Use stable IDs for relationships:

- Sales reference `cropId`
- Batches reference `cropId`
- Sales reference `customerId`
- Records reference `userId`

Names can change; IDs should not.

Add metadata to important records:

```js
{
  createdAt,
  updatedAt,
  createdBy,
  updatedBy,
  version,
  deletedAt
}
```

Use soft deletion for financial and inventory records.

## 10. Add caching and pagination

For larger datasets:

- Paginate sales history
- Load recent sales first
- Cache product and batch lookups
- Avoid loading every document on every screen
- Debounce search
- Virtualize very large lists
- Refresh only affected data after a sale

## 11. Define failure recovery

Design explicitly for:

- Browser refresh during checkout
- Power loss after payment
- M-PESA timeout
- Duplicate payment callbacks
- Partial synchronization failure
- Database conflicts
- Server unavailability
- eTIMS unavailability

Payment and tax integrations should use explicit asynchronous statuses:

```text
pending → processing → completed
pending → failed
pending → requires_review
```

A timeout should not automatically be treated as a failed payment.

## Recommended implementation order

### Phase 1: Correctness

1. Create a shared sale-total calculation.
2. Add server-side validation.
3. Make inventory deduction atomic.
4. Add idempotency keys.
5. Add audit records.

### Phase 2: Performance

1. Add database indexes.
2. Remove repeated full-database scans.
3. Cache active presale reservations.
4. Add pagination.
5. Debounce search.

### Phase 3: Reliability

1. Add an offline outbox.
2. Add retry and conflict handling.
3. Add health checks and structured logging.
4. Verify backups.
5. Recover interrupted sales.

### Phase 4: Scalability

1. Move business-critical writes to the server.
2. Use a transactional server database.
3. Add background workers for M-PESA and eTIMS.
4. Add monitoring and alerting.
5. Separate reporting workloads from transactional workloads.

## Highest-priority risk

The most urgent issue is ensuring that a sale, inventory deduction, discount, payment, and tax record cannot disagree with one another. Data consistency should be addressed before visual performance optimizations.
