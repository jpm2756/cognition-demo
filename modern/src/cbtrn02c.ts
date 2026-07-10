import { readFileSync } from "fs";
import { join } from "path";

const ACCOUNT_LENGTH = 300;
const DAILY_TRANSACTION_LENGTH = 350;
const CATEGORY_BALANCE_LENGTH = 50;

const positiveOverpunch = "{ABCDEFGHI";
const negativeOverpunch = "}JKLMNOPQR";

export interface Cbtrn02cPaths {
  accounts: string;
  cardXrefs: string;
  dailyTransactions: string;
  categoryBalances: string;
}

export interface AccountRecord {
  id: string;
  currentBalance: number;
  creditLimit: number;
  currentCycleCredit: number;
  currentCycleDebit: number;
  expirationDate: string;
  raw: string;
}

export interface CategoryBalanceRecord {
  key: string;
  accountId: string;
  typeCode: string;
  categoryCode: string;
  balance: number;
  raw: string;
}

export interface Cbtrn02cResult {
  lines: string[];
  accounts: Map<string, AccountRecord>;
  categoryBalances: Map<string, CategoryBalanceRecord>;
  transactionRecords: string[];
  rejectRecords: string[];
}

interface DailyTransaction {
  id: string;
  typeCode: string;
  categoryCode: string;
  amount: number;
  cardNumber: string;
  originalTimestamp: string;
  raw: string;
}

export function decodeZoned(field: string): number {
  if (field.length === 0) {
    throw new Error("Cannot decode an empty zoned-decimal field");
  }
  const last = field[field.length - 1] ?? "";
  const positiveDigit = positiveOverpunch.indexOf(last);
  const negativeDigit = negativeOverpunch.indexOf(last);
  let sign = 1;
  let digit = last;
  if (positiveDigit >= 0) {
    digit = String(positiveDigit);
  } else if (negativeDigit >= 0) {
    sign = -1;
    digit = String(negativeDigit);
  } else if (!/^\d$/.test(last)) {
    throw new Error(`Invalid zoned-decimal trailing byte: ${last}`);
  }
  const digits = field.slice(0, -1) + digit;
  if (!/^\d+$/.test(digits)) {
    throw new Error(`Invalid zoned-decimal field: ${field}`);
  }
  const value = Number(digits);
  return value === 0 ? 0 : sign * value;
}

export function encodeZoned(value: number, width: number): string {
  if (!Number.isSafeInteger(value) || width < 1) {
    throw new Error("Zoned-decimal values require a safe integer and positive width");
  }
  const digits = String(Math.abs(value)).padStart(width, "0");
  if (digits.length > width) {
    throw new Error(`Value ${value} exceeds PIC width ${width}`);
  }
  const lastDigit = Number(digits[digits.length - 1]);
  const overpunch = value < 0
    ? negativeOverpunch[lastDigit]
    : positiveOverpunch[lastDigit];
  return digits.slice(0, -1) + overpunch;
}

function readRecords(path: string, length: number): string[] {
  const text = readFileSync(path, "latin1");
  return text
    .split(/\r?\n/)
    .filter((record) => record.length > 0)
    .map((record) => record.padEnd(length, " ").slice(0, length));
}

function parseAccount(raw: string): AccountRecord {
  return {
    id: raw.slice(0, 11),
    currentBalance: decodeZoned(raw.slice(12, 24)),
    creditLimit: decodeZoned(raw.slice(24, 36)),
    expirationDate: raw.slice(58, 68),
    currentCycleCredit: decodeZoned(raw.slice(78, 90)),
    currentCycleDebit: decodeZoned(raw.slice(90, 102)),
    raw,
  };
}

function renderAccount(account: AccountRecord): string {
  return (
    account.raw.slice(0, 12) +
    encodeZoned(account.currentBalance, 12) +
    account.raw.slice(24, 78) +
    encodeZoned(account.currentCycleCredit, 12) +
    encodeZoned(account.currentCycleDebit, 12) +
    account.raw.slice(102)
  ).padEnd(ACCOUNT_LENGTH, " ").slice(0, ACCOUNT_LENGTH);
}

function parseCategoryBalance(raw: string): CategoryBalanceRecord {
  return {
    key: raw.slice(0, 17),
    accountId: raw.slice(0, 11),
    typeCode: raw.slice(11, 13),
    categoryCode: raw.slice(13, 17),
    balance: decodeZoned(raw.slice(17, 28)),
    raw,
  };
}

function renderCategoryBalance(record: CategoryBalanceRecord): string {
  return (
    record.key +
    encodeZoned(record.balance, 11) +
    record.raw.slice(28)
  ).padEnd(CATEGORY_BALANCE_LENGTH, " ").slice(0, CATEGORY_BALANCE_LENGTH);
}

function parseDailyTransaction(raw: string): DailyTransaction {
  return {
    id: raw.slice(0, 16),
    typeCode: raw.slice(16, 18),
    categoryCode: raw.slice(18, 22),
    amount: decodeZoned(raw.slice(132, 143)),
    cardNumber: raw.slice(262, 278),
    originalTimestamp: raw.slice(278, 304),
    raw,
  };
}

function formatProcessingTimestamp(date: Date): string {
  const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const hundredths = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}.${min}.${ss}.${hundredths}0000`;
}

function renderTransaction(transaction: DailyTransaction, processedAt: Date): string {
  return (
    transaction.raw.slice(0, 132) +
    encodeZoned(transaction.amount, 11) +
    transaction.raw.slice(143, 304) +
    formatProcessingTimestamp(processedAt) +
    " ".repeat(20)
  ).slice(0, DAILY_TRANSACTION_LENGTH);
}

function renderReject(transaction: DailyTransaction, reason: number, description: string): string {
  return transaction.raw + String(reason).padStart(4, "0") + description.padEnd(76, " ");
}

export function run(paths: Cbtrn02cPaths, processedAt = new Date()): Cbtrn02cResult {
  const accounts = new Map(
    readRecords(paths.accounts, ACCOUNT_LENGTH)
      .map(parseAccount)
      .map((account) => [account.id, account]),
  );
  const cardXrefs = new Map(
    readRecords(paths.cardXrefs, 50)
      .map((raw) => [raw.slice(0, 16), raw.slice(25, 36)]),
  );
  const categoryBalances = new Map(
    readRecords(paths.categoryBalances, CATEGORY_BALANCE_LENGTH)
      .map(parseCategoryBalance)
      .map((record) => [record.key, record]),
  );
  const dailyTransactions = readRecords(paths.dailyTransactions, DAILY_TRANSACTION_LENGTH)
    .map(parseDailyTransaction);

  const lines = ["START OF EXECUTION OF PROGRAM CBTRN02C"];
  const transactionRecords: string[] = [];
  const rejectRecords: string[] = [];
  let rejected = 0;

  for (const transaction of dailyTransactions) {
    const accountId = cardXrefs.get(transaction.cardNumber);
    let reason = 0;
    let description = "";
    let account: AccountRecord | undefined;

    if (accountId === undefined) {
      reason = 100;
      description = "INVALID CARD NUMBER FOUND";
    } else {
      account = accounts.get(accountId);
      if (account === undefined) {
        reason = 101;
        description = "ACCOUNT RECORD NOT FOUND";
      } else {
        const temporaryBalance =
          account.currentCycleCredit - account.currentCycleDebit + transaction.amount;
        if (account.creditLimit < temporaryBalance) {
          reason = 102;
          description = "OVERLIMIT TRANSACTION";
        }
        if (account.expirationDate < transaction.originalTimestamp.slice(0, 10)) {
          reason = 103;
          description = "TRANSACTION RECEIVED AFTER ACCT EXPIRATION";
        }
      }
    }

    if (reason !== 0 || account === undefined || accountId === undefined) {
      rejected += 1;
      rejectRecords.push(renderReject(transaction, reason, description));
      continue;
    }

    const categoryKey = accountId + transaction.typeCode + transaction.categoryCode;
    let category = categoryBalances.get(categoryKey);
    if (category === undefined) {
      lines.push(`TCATBAL record not found for key : ${categoryKey}.. Creating.`);
      category = {
        key: categoryKey,
        accountId,
        typeCode: transaction.typeCode,
        categoryCode: transaction.categoryCode,
        balance: 0,
        raw: " ".repeat(CATEGORY_BALANCE_LENGTH),
      };
    }
    category.balance += transaction.amount;
    category.raw = renderCategoryBalance(category);
    categoryBalances.set(categoryKey, category);

    account.currentBalance += transaction.amount;
    if (transaction.amount >= 0) {
      account.currentCycleCredit += transaction.amount;
    } else {
      account.currentCycleDebit += transaction.amount;
    }
    account.raw = renderAccount(account);
    accounts.set(account.id, account);
    transactionRecords.push(renderTransaction(transaction, processedAt));
  }

  lines.push(`TRANSACTIONS PROCESSED :${String(dailyTransactions.length).padStart(9, "0")}`);
  lines.push(`TRANSACTIONS REJECTED  :${String(rejected).padStart(9, "0")}`);
  lines.push("END OF EXECUTION OF PROGRAM CBTRN02C");

  return { lines, accounts, categoryBalances, transactionRecords, rejectRecords };
}

export function fixturePaths(legacyDir: string): Cbtrn02cPaths {
  return {
    accounts: join(legacyDir, "cbtrn02c_acctdata.txt"),
    cardXrefs: join(legacyDir, "cbtrn02c_cardxref.txt"),
    dailyTransactions: join(legacyDir, "cbtrn02c_dailytran.txt"),
    categoryBalances: join(legacyDir, "cbtrn02c_tcatbal.txt"),
  };
}

if (require.main === module) {
  const legacyDir = process.argv[2] ?? join(__dirname, "..", "..", "legacy");
  process.stdout.write(run(fixturePaths(legacyDir)).lines.join("\n") + "\n");
}
