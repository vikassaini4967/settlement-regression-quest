/**
 * Business rules for the weekly rewards settlement.
 *
 * These are the ASSESSMENT rules from the MUST Company quest brief, restated as
 * code so there is exactly one place where "what the business promised" lives.
 * They are a fictional rewards service, not a description of any live product.
 *
 *  R1  Settlement runs every Tuesday at 09:00 UTC.
 *  R2  The settled period is [Monday 00:00:00.000 UTC, the following Monday
 *      00:00:00.000 UTC). Lower bound INCLUSIVE, upper bound EXCLUSIVE.
 *      The period settled by a Tuesday run is the week that closed at the most
 *      recent Monday 00:00 UTC — i.e. it ends ~33 hours before the run fires.
 *  R3  Each qualifying completed task earns CREDITS_PER_TASK test credits.
 *  R4  A task ID is counted at most once, ever. Duplicates in the source data
 *      and repeated settlement runs must not create a second payout.
 *  R5  A notification is sent only AFTER a payout has been committed.
 *  R6  A notification failure must never reverse or block a committed payout.
 *
 * All timestamps in this service are UTC instants. There is no "server local
 * time" anywhere in the business rules. That sentence is the entire subject of
 * defect SETL-001.
 */

/** Credits awarded per qualifying task (R3). Overridable by admin config. */
export const CREDITS_PER_TASK = 10;

/** Day of week the settlement job fires, UTC. 0 = Sunday, 2 = Tuesday (R1). */
export const SETTLEMENT_DAY_OF_WEEK_UTC = 2;

/** Hour the settlement job fires, UTC (R1). */
export const SETTLEMENT_HOUR_UTC = 9;

/** Only these task states are ever eligible for payout. */
export const ELIGIBLE_TASK_STATUS = 'COMPLETED';

/** Only users in this account state receive a payout; others are held. */
export const PAYABLE_ACCOUNT_STATUS = 'ACTIVE';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/** Default admin console configuration. */
export function defaultAdminConfig() {
  return {
    creditsPerTask: CREDITS_PER_TASK,
    settlementDayOfWeekUtc: SETTLEMENT_DAY_OF_WEEK_UTC,
    settlementHourUtc: SETTLEMENT_HOUR_UTC,
    notificationsEnabled: true,
  };
}
