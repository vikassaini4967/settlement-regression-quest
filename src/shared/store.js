/**
 * Minimal in-memory stand-in for the ledger, user table, task table and
 * notification provider.
 *
 * It is deliberately tiny, but it keeps the three properties that make the
 * settlement bugs reproducible at all:
 *
 *   - the ledger enforces a unique idempotency key, like a real UNIQUE index;
 *   - a ledger write and a notification send are SEPARATE operations that can
 *     fail independently;
 *   - both can be made to fail on demand, so partial failure and notification
 *     failure are testable without a live financial system.
 *
 * Nothing here talks to a network. There is no live system under test.
 */

export class LedgerWriteError extends Error {
  constructor(userId) {
    super(`injected ledger write failure for ${userId}`);
    this.name = 'LedgerWriteError';
    this.userId = userId;
  }
}

export class NotificationSendError extends Error {
  constructor(userId) {
    super(`injected notification delivery failure for ${userId}`);
    this.name = 'NotificationSendError';
    this.userId = userId;
  }
}

export function createStore({ tasks = [], users = [] } = {}) {
  const faults = {
    ledgerFailFor: new Set(),
    notificationFailFor: new Set(),
  };

  const store = {
    tasks: tasks.map((t) => ({ ...t })),
    users: new Map(users.map((u) => [u.userId, { ...u }])),
    /** @type {Array<{idempotencyKey:string,userId:string,periodId:string,credits:number,taskIds:string[],committedAt:string}>} */
    ledger: [],
    /** @type {Array<{userId:string,periodId:string,credits:number,status:string,attemptedAt:string}>} */
    notifications: [],
    /** @type {string[]} */
    auditLog: [],

    faults,

    // ---- fault injection, used only by tests -------------------------------
    failLedgerFor(userId) {
      faults.ledgerFailFor.add(userId);
      return store;
    },
    failNotificationFor(userId) {
      faults.notificationFailFor.add(userId);
      return store;
    },
    clearFaults() {
      faults.ledgerFailFor.clear();
      faults.notificationFailFor.clear();
      return store;
    },

    // ---- ledger ------------------------------------------------------------
    hasSettled(idempotencyKey) {
      return store.ledger.some((e) => e.idempotencyKey === idempotencyKey);
    },

    /** Commits a payout. Throws on injected failure or duplicate key (R4). */
    writeLedger(entry) {
      if (faults.ledgerFailFor.has(entry.userId)) {
        throw new LedgerWriteError(entry.userId);
      }
      if (store.hasSettled(entry.idempotencyKey)) {
        throw new Error(`duplicate idempotency key ${entry.idempotencyKey}`);
      }
      const committed = { ...entry, committedAt: new Date().toISOString() };
      store.ledger.push(committed);
      store.auditLog.push(`LEDGER_COMMIT ${entry.idempotencyKey} ${entry.credits}cr`);
      return committed;
    },

    creditsFor(userId) {
      return store.ledger
        .filter((e) => e.userId === userId)
        .reduce((sum, e) => sum + e.credits, 0);
    },

    ledgerFor(userId) {
      return store.ledger.filter((e) => e.userId === userId);
    },

    /** Every task ID that has ever been paid, across all periods (R4). */
    paidTaskIds() {
      return new Set(store.ledger.flatMap((e) => e.taskIds));
    },

    // ---- notifications -----------------------------------------------------
    sendNotification(payload) {
      if (faults.notificationFailFor.has(payload.userId)) {
        throw new NotificationSendError(payload.userId);
      }
      store.auditLog.push(`NOTIFY_SENT ${payload.userId} ${payload.periodId}`);
      return { delivered: true };
    },

    recordNotification(record) {
      store.notifications.push({ ...record, attemptedAt: new Date().toISOString() });
    },

    notificationsFor(userId) {
      return store.notifications.filter((n) => n.userId === userId);
    },

    // ---- users -------------------------------------------------------------
    setAccountStatus(userId, status) {
      const user = store.users.get(userId);
      if (!user) throw new Error(`unknown user ${userId}`);
      user.status = status;
      store.auditLog.push(`ACCOUNT_STATUS ${userId} -> ${status}`);
      return store;
    },
  };

  return store;
}
