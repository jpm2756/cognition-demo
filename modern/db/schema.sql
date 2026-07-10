-- Schema for the CBACT01C database-parity harness.
--
-- Two structurally-identical tables hold the account records as decoded by
-- each implementation:
--   * legacy_accounts  <- parsed from the GnuCOBOL golden baseline report
--   * modern_accounts   <- parsed from the modern TypeScript service output
--
-- Because both are derived independently (COBOL vs. TypeScript), a diff of
-- zero rows proves record/column-level parity, and matching SUM(curr_bal)
-- reconciles the ledger to the cent.

CREATE TABLE IF NOT EXISTS legacy_accounts (
  acct_id           BIGINT PRIMARY KEY,
  active_status     TEXT           NOT NULL,
  curr_bal          NUMERIC(14, 2) NOT NULL,
  credit_limit      NUMERIC(14, 2) NOT NULL,
  cash_credit_limit NUMERIC(14, 2) NOT NULL,
  open_date         TEXT           NOT NULL,
  expiration_date   TEXT           NOT NULL,
  reissue_date      TEXT           NOT NULL,
  curr_cyc_credit   NUMERIC(14, 2) NOT NULL,
  curr_cyc_debit    NUMERIC(14, 2) NOT NULL,
  group_id          TEXT           NOT NULL
);

CREATE TABLE IF NOT EXISTS modern_accounts (
  LIKE legacy_accounts INCLUDING ALL
);
