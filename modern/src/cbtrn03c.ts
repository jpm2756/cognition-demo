import { readFileSync } from "fs";

const REPORT_RECORD_LENGTH = 133;
const PAGE_SIZE = 20;

export interface Transaction {
  id: string;
  typeCode: string;
  categoryCode: string;
  source: string;
  amountField: string;
  cardNumber: string;
  processTimestamp: string;
}

export interface Cbtrn03cInputs {
  transactionsPath: string;
  cardXrefPath: string;
  transactionTypePath: string;
  transactionCategoryPath: string;
  startDate: string;
  endDate: string;
}

function records(path: string): string[] {
  return readFileSync(path, "latin1")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

export function parseTransaction(record: string): Transaction {
  const value = record.padEnd(350, " ");
  return {
    id: value.slice(0, 16),
    typeCode: value.slice(16, 18),
    categoryCode: value.slice(18, 22),
    source: value.slice(22, 32),
    amountField: value.slice(132, 143),
    cardNumber: value.slice(262, 278),
    processTimestamp: value.slice(304, 330),
  };
}

export function decodeMfZonedAmount(field: string): number {
  const value = field.padStart(11, "0").slice(-11);
  const last = value[10];
  const digits = value.slice(0, 10) + (last >= "0" && last <= "9" ? last : "0");
  return Number.parseInt(digits, 10);
}

export function formatEditedAmount(
  cents: number,
  signPicture: "+" | "-",
): string {
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const decimal = String(absolute % 100).padStart(2, "0");
  const numeric = `${whole.toLocaleString("en-US")}.${decimal}`.padStart(14, " ");
  const sign = cents < 0 ? "-" : signPicture === "+" ? "+" : " ";
  return sign + numeric;
}

function fixedRecord(value: string): string {
  return value.slice(0, REPORT_RECORD_LENGTH).padEnd(REPORT_RECORD_LENGTH, " ");
}

function reportHeader(startDate: string, endDate: string): string {
  return fixedRecord(
    "DALYREPT".padEnd(38, " ") +
      "Daily Transaction Report".padEnd(41, " ") +
      "Date Range: ".padEnd(12, " ") +
      startDate.padEnd(10, " ").slice(0, 10) +
      " to " +
      endDate.padEnd(10, " ").slice(0, 10),
  );
}

function transactionHeader(): string {
  return fixedRecord(
    "Transaction ID".padEnd(17, " ") +
      "Account ID".padEnd(12, " ") +
      "Transaction Type".padEnd(19, " ") +
      "Tran Category".padEnd(35, " ") +
      "Tran Source".padEnd(14, " ") +
      " " +
      "        Amount".padEnd(16, " "),
  );
}

function totalRecord(
  label: "Page Total" | "Account Total" | "Grand Total",
  cents: number,
): string {
  const labelWidth = label === "Account Total" ? 13 : 11;
  const dotWidth = label === "Account Total" ? 84 : 86;
  return fixedRecord(
    label.padEnd(labelWidth, " ") +
      ".".repeat(dotWidth) +
      formatEditedAmount(cents, "+"),
  );
}

function detailRecord(
  transaction: Transaction,
  accountId: string,
  typeDescription: string,
  categoryDescription: string,
  amount: number,
): string {
  return fixedRecord(
    transaction.id +
      " " +
      accountId +
      " " +
      transaction.typeCode +
      "-" +
      typeDescription.slice(0, 15).padEnd(15, " ") +
      " " +
      transaction.categoryCode +
      "-" +
      categoryDescription.slice(0, 29).padEnd(29, " ") +
      " " +
      transaction.source +
      "    " +
      formatEditedAmount(amount, "-") +
      "  ",
  );
}

function loadCardXrefs(path: string): Map<string, string> {
  return new Map(
    records(path).map((record) => {
      const value = record.padEnd(50, " ");
      return [value.slice(0, 16), value.slice(25, 36)];
    }),
  );
}

function loadTransactionTypes(path: string): Map<string, string> {
  return new Map(
    records(path).map((record) => {
      const value = record.padEnd(60, " ");
      return [value.slice(0, 2), value.slice(2, 52)];
    }),
  );
}

function loadTransactionCategories(path: string): Map<string, string> {
  return new Map(
    records(path).map((record) => {
      const value = record.padEnd(60, " ");
      return [value.slice(0, 6), value.slice(6, 56)];
    }),
  );
}

export function runCbtrn03c(inputs: Cbtrn03cInputs): Buffer {
  const cardXrefs = loadCardXrefs(inputs.cardXrefPath);
  const transactionTypes = loadTransactionTypes(inputs.transactionTypePath);
  const transactionCategories = loadTransactionCategories(
    inputs.transactionCategoryPath,
  );
  const transactions = records(inputs.transactionsPath)
    .map(parseTransaction)
    .filter((transaction) => {
      const date = transaction.processTimestamp.slice(0, 10);
      return date >= inputs.startDate && date <= inputs.endDate;
    });

  if (transactions.length === 0) {
    return Buffer.alloc(0);
  }

  const output: string[] = [];
  let firstTime = true;
  let lineCounter = 0;
  let pageTotal = 0;
  let accountTotal = 0;
  let grandTotal = 0;
  let currentCardNumber = "";

  const writeHeaders = (): void => {
    output.push(reportHeader(inputs.startDate, inputs.endDate));
    output.push(" ".repeat(REPORT_RECORD_LENGTH));
    output.push(transactionHeader());
    output.push("-".repeat(REPORT_RECORD_LENGTH));
    lineCounter += 4;
  };

  const writePageTotals = (): void => {
    output.push(totalRecord("Page Total", pageTotal));
    grandTotal += pageTotal;
    pageTotal = 0;
    lineCounter += 1;
    output.push("-".repeat(REPORT_RECORD_LENGTH));
    lineCounter += 1;
  };

  const writeAccountTotals = (): void => {
    output.push(totalRecord("Account Total", accountTotal));
    accountTotal = 0;
    lineCounter += 1;
    output.push("-".repeat(REPORT_RECORD_LENGTH));
    lineCounter += 1;
  };

  for (const transaction of transactions) {
    if (currentCardNumber !== transaction.cardNumber) {
      if (!firstTime) {
        writeAccountTotals();
      }
      currentCardNumber = transaction.cardNumber;
    }

    const accountId = cardXrefs.get(transaction.cardNumber);
    const typeDescription = transactionTypes.get(transaction.typeCode);
    const categoryDescription = transactionCategories.get(
      transaction.typeCode + transaction.categoryCode,
    );
    if (
      accountId === undefined ||
      typeDescription === undefined ||
      categoryDescription === undefined
    ) {
      throw new Error(`Missing lookup data for transaction ${transaction.id}`);
    }

    if (firstTime) {
      firstTime = false;
      writeHeaders();
    }
    if (lineCounter % PAGE_SIZE === 0) {
      writePageTotals();
      writeHeaders();
    }

    const amount = decodeMfZonedAmount(transaction.amountField);
    pageTotal += amount;
    accountTotal += amount;
    output.push(
      detailRecord(
        transaction,
        accountId,
        typeDescription,
        categoryDescription,
        amount,
      ),
    );
    lineCounter += 1;
  }

  const retainedAmount = decodeMfZonedAmount(
    transactions[transactions.length - 1].amountField,
  );
  pageTotal += retainedAmount;
  accountTotal += retainedAmount;
  writePageTotals();
  output.push(totalRecord("Grand Total", grandTotal));

  return Buffer.from(output.join(""), "latin1");
}

if (require.main === module) {
  const [
    transactionsPath,
    cardXrefPath,
    transactionTypePath,
    transactionCategoryPath,
    startDate = "2022-01-01",
    endDate = "2022-07-06",
  ] = process.argv.slice(2);
  if (
    transactionsPath === undefined ||
    cardXrefPath === undefined ||
    transactionTypePath === undefined ||
    transactionCategoryPath === undefined
  ) {
    throw new Error(
      "Usage: cbtrn03c <transactions> <cardxref> <trantype> <trancatg> [start] [end]",
    );
  }
  process.stdout.write(
    runCbtrn03c({
      transactionsPath,
      cardXrefPath,
      transactionTypePath,
      transactionCategoryPath,
      startDate,
      endDate,
    }),
  );
}
