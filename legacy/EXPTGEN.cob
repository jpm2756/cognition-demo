      ******************************************************************
      * EXPTGEN - generates the deterministic CardDemo branch-migration
      * export fixture (expdata.dat) consumed by CBIMPORT. It builds a
      * handful of typed EXPORT-RECORDs (one per record type C/A/X/T/D,
      * plus a second account with negative amounts) using the SHARED
      * CVEXPORT copybook, so the COMP / COMP-3 / zoned encodings are
      * exactly what the unmodified CBIMPORT expects. Records are written
      * as fixed 500-byte RECORD SEQUENTIAL so binary bytes survive.
      *
      * This is a one-time fixture builder; expdata.dat is committed and
      * treated as trusted input (like acctdata.txt for CBACT01C). The
      * golden BASELINE (program output) is always rebuilt from source.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. EXPTGEN.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT EXP-FILE ASSIGN TO "expdata.dat"
                  ORGANIZATION IS SEQUENTIAL
                  FILE STATUS IS WS-STATUS.
       DATA DIVISION.
       FILE SECTION.
       FD  EXP-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 500 CHARACTERS.
       01  EXP-OUT-REC                 PIC X(500).
       WORKING-STORAGE SECTION.
       01  WS-STATUS                   PIC XX.
       COPY CVEXPORT.
       PROCEDURE DIVISION.
           OPEN OUTPUT EXP-FILE

      *--- Record 1: CUSTOMER (type C) --------------------------------
           INITIALIZE EXPORT-RECORD
           MOVE 'C'                     TO EXPORT-REC-TYPE
           MOVE '2025-05-20-10.00.00.000000' TO EXPORT-TIMESTAMP
           MOVE 1                       TO EXPORT-SEQUENCE-NUM
           MOVE 'BR01'                  TO EXPORT-BRANCH-ID
           MOVE 'NE001'                 TO EXPORT-REGION-CODE
           MOVE 900000001              TO EXP-CUST-ID
           MOVE 'JOHN'                  TO EXP-CUST-FIRST-NAME
           MOVE 'Q'                     TO EXP-CUST-MIDDLE-NAME
           MOVE 'PUBLIC'                TO EXP-CUST-LAST-NAME
           MOVE '123 MAIN ST'           TO EXP-CUST-ADDR-LINE(1)
           MOVE 'APT 4'                 TO EXP-CUST-ADDR-LINE(2)
           MOVE 'FLOOR 2'               TO EXP-CUST-ADDR-LINE(3)
           MOVE 'NY'                    TO EXP-CUST-ADDR-STATE-CD
           MOVE 'USA'                   TO EXP-CUST-ADDR-COUNTRY-CD
           MOVE '10001'                 TO EXP-CUST-ADDR-ZIP
           MOVE '212-555-0100'          TO EXP-CUST-PHONE-NUM(1)
           MOVE '212-555-0101'          TO EXP-CUST-PHONE-NUM(2)
           MOVE 123456789              TO EXP-CUST-SSN
           MOVE 'NY-DL-12345'           TO EXP-CUST-GOVT-ISSUED-ID
           MOVE '1980-01-15'            TO EXP-CUST-DOB-YYYY-MM-DD
           MOVE 'EFT0000001'            TO EXP-CUST-EFT-ACCOUNT-ID
           MOVE 'Y'                     TO EXP-CUST-PRI-CARD-HOLDER-IND
           MOVE 750                     TO EXP-CUST-FICO-CREDIT-SCORE
           MOVE EXPORT-RECORD           TO EXP-OUT-REC
           WRITE EXP-OUT-REC

      *--- Record 2: ACCOUNT (type A), positive amounts ---------------
           INITIALIZE EXPORT-RECORD
           MOVE 'A'                     TO EXPORT-REC-TYPE
           MOVE '2025-05-20-10.00.01.000000' TO EXPORT-TIMESTAMP
           MOVE 2                       TO EXPORT-SEQUENCE-NUM
           MOVE 'BR01'                  TO EXPORT-BRANCH-ID
           MOVE 'NE001'                 TO EXPORT-REGION-CODE
           MOVE 90000000001            TO EXP-ACCT-ID
           MOVE 'Y'                     TO EXP-ACCT-ACTIVE-STATUS
           MOVE 1234.56                 TO EXP-ACCT-CURR-BAL
           MOVE 5000.00                 TO EXP-ACCT-CREDIT-LIMIT
           MOVE 2500.00                 TO EXP-ACCT-CASH-CREDIT-LIMIT
           MOVE '2014-11-20'            TO EXP-ACCT-OPEN-DATE
           MOVE '2025-05-20'            TO EXP-ACCT-EXPIRAION-DATE
           MOVE '2025-05-20'            TO EXP-ACCT-REISSUE-DATE
           MOVE 100.00                  TO EXP-ACCT-CURR-CYC-CREDIT
           MOVE 200.00                  TO EXP-ACCT-CURR-CYC-DEBIT
           MOVE '10001'                 TO EXP-ACCT-ADDR-ZIP
           MOVE 'GRP1'                  TO EXP-ACCT-GROUP-ID
           MOVE EXPORT-RECORD           TO EXP-OUT-REC
           WRITE EXP-OUT-REC

      *--- Record 3: CARD-XREF (type X) -------------------------------
           INITIALIZE EXPORT-RECORD
           MOVE 'X'                     TO EXPORT-REC-TYPE
           MOVE '2025-05-20-10.00.02.000000' TO EXPORT-TIMESTAMP
           MOVE 3                       TO EXPORT-SEQUENCE-NUM
           MOVE 'BR01'                  TO EXPORT-BRANCH-ID
           MOVE 'NE001'                 TO EXPORT-REGION-CODE
           MOVE '4111111111111111'      TO EXP-XREF-CARD-NUM
           MOVE 900000001              TO EXP-XREF-CUST-ID
           MOVE 90000000001            TO EXP-XREF-ACCT-ID
           MOVE EXPORT-RECORD           TO EXP-OUT-REC
           WRITE EXP-OUT-REC

      *--- Record 4: TRANSACTION (type T) -----------------------------
           INITIALIZE EXPORT-RECORD
           MOVE 'T'                     TO EXPORT-REC-TYPE
           MOVE '2025-05-20-10.00.03.000000' TO EXPORT-TIMESTAMP
           MOVE 4                       TO EXPORT-SEQUENCE-NUM
           MOVE 'BR01'                  TO EXPORT-BRANCH-ID
           MOVE 'NE001'                 TO EXPORT-REGION-CODE
           MOVE 'TRN0000000000001'      TO EXP-TRAN-ID
           MOVE '01'                    TO EXP-TRAN-TYPE-CD
           MOVE 1                       TO EXP-TRAN-CAT-CD
           MOVE 'POS'                   TO EXP-TRAN-SOURCE
           MOVE 'GROCERY PURCHASE'      TO EXP-TRAN-DESC
           MOVE 75.50                   TO EXP-TRAN-AMT
           MOVE 100000001              TO EXP-TRAN-MERCHANT-ID
           MOVE 'ACME FOODS'            TO EXP-TRAN-MERCHANT-NAME
           MOVE 'NEW YORK'              TO EXP-TRAN-MERCHANT-CITY
           MOVE '10001'                 TO EXP-TRAN-MERCHANT-ZIP
           MOVE '4111111111111111'      TO EXP-TRAN-CARD-NUM
           MOVE '2025-05-20 10:00:00.000000' TO EXP-TRAN-ORIG-TS
           MOVE '2025-05-20 10:00:05.000000' TO EXP-TRAN-PROC-TS
           MOVE EXPORT-RECORD           TO EXP-OUT-REC
           WRITE EXP-OUT-REC

      *--- Record 5: CARD (type D) ------------------------------------
           INITIALIZE EXPORT-RECORD
           MOVE 'D'                     TO EXPORT-REC-TYPE
           MOVE '2025-05-20-10.00.04.000000' TO EXPORT-TIMESTAMP
           MOVE 5                       TO EXPORT-SEQUENCE-NUM
           MOVE 'BR01'                  TO EXPORT-BRANCH-ID
           MOVE 'NE001'                 TO EXPORT-REGION-CODE
           MOVE '4111111111111111'      TO EXP-CARD-NUM
           MOVE 90000000001            TO EXP-CARD-ACCT-ID
           MOVE 123                     TO EXP-CARD-CVV-CD
           MOVE 'JOHN Q PUBLIC'         TO EXP-CARD-EMBOSSED-NAME
           MOVE '2025-05-31'            TO EXP-CARD-EXPIRAION-DATE
           MOVE 'Y'                     TO EXP-CARD-ACTIVE-STATUS
           MOVE EXPORT-RECORD           TO EXP-OUT-REC
           WRITE EXP-OUT-REC

      *--- Record 6: ACCOUNT (type A), negative amounts ---------------
           INITIALIZE EXPORT-RECORD
           MOVE 'A'                     TO EXPORT-REC-TYPE
           MOVE '2025-05-20-10.00.05.000000' TO EXPORT-TIMESTAMP
           MOVE 6                       TO EXPORT-SEQUENCE-NUM
           MOVE 'BR02'                  TO EXPORT-BRANCH-ID
           MOVE 'SW002'                 TO EXPORT-REGION-CODE
           MOVE 90000000002            TO EXP-ACCT-ID
           MOVE 'N'                     TO EXP-ACCT-ACTIVE-STATUS
           MOVE -1500.00                TO EXP-ACCT-CURR-BAL
           MOVE -250.00                 TO EXP-ACCT-CREDIT-LIMIT
           MOVE 0.00                    TO EXP-ACCT-CASH-CREDIT-LIMIT
           MOVE '2013-06-19'            TO EXP-ACCT-OPEN-DATE
           MOVE '2024-08-11'            TO EXP-ACCT-EXPIRAION-DATE
           MOVE '2024-08-11'            TO EXP-ACCT-REISSUE-DATE
           MOVE -75.25                  TO EXP-ACCT-CURR-CYC-CREDIT
           MOVE -300.00                 TO EXP-ACCT-CURR-CYC-DEBIT
           MOVE '10002'                 TO EXP-ACCT-ADDR-ZIP
           MOVE 'GRP2'                  TO EXP-ACCT-GROUP-ID
           MOVE EXPORT-RECORD           TO EXP-OUT-REC
           WRITE EXP-OUT-REC

           CLOSE EXP-FILE
           DISPLAY 'EXPTGEN: wrote 6 export records to expdata.dat'
           STOP RUN.
