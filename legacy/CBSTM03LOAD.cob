      ******************************************************************
      * CBSTM03LOAD - stages the small ASCII CBSTM03A fixture extracts
      * into the INDEXED (KSDS) files that the unmodified CBSTM03A /
      * CBSTM03B expect. This replaces the mainframe IDCAMS/SORT REPRO
      * steps (see app/jcl/CREASTMT.JCL) for off-platform runs.
      *
      * Keys mirror CBSTM03B's SELECTs:
      *   TRNXFILE  key = card(16)+tranid(16) = 32   RECLN 350
      *   XREFFILE  key = card(16)                    RECLN 50
      *   CUSTFILE  key = cust-id(9)                   RECLN 500
      *   ACCTFILE  key = acct-id 9(11)                RECLN 300
      * Flat inputs must be pre-sorted ascending by key.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBSTM03LOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT TRNX-IN  ASSIGN TO "cbstm03a_trnx.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.
           SELECT XREF-IN  ASSIGN TO "cbstm03a_xref.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.
           SELECT CUST-IN  ASSIGN TO "cbstm03a_cust.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.
           SELECT ACCT-IN  ASSIGN TO "cbstm03a_acct.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.

           SELECT TRNX-FILE ASSIGN TO TRNXFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-TRNXS-ID
                  FILE STATUS  IS OUT-STATUS.
           SELECT XREF-FILE ASSIGN TO XREFFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-XREF-CARD-NUM
                  FILE STATUS  IS OUT-STATUS.
           SELECT CUST-FILE ASSIGN TO CUSTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-CUST-ID
                  FILE STATUS  IS OUT-STATUS.
           SELECT ACCT-FILE ASSIGN TO ACCTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-ACCT-ID
                  FILE STATUS  IS OUT-STATUS.
       DATA DIVISION.
       FILE SECTION.
       FD  TRNX-IN.
       01  TRNX-IN-REC            PIC X(350).
       FD  XREF-IN.
       01  XREF-IN-REC            PIC X(50).
       FD  CUST-IN.
       01  CUST-IN-REC            PIC X(500).
       FD  ACCT-IN.
       01  ACCT-IN-REC            PIC X(300).

       FD  TRNX-FILE.
       01  FD-TRNXFILE-REC.
           05 FD-TRNXS-ID.
              10  FD-TRNX-CARD    PIC X(16).
              10  FD-TRNX-ID      PIC X(16).
           05 FD-TRNX-DATA        PIC X(318).
       FD  XREF-FILE.
       01  FD-XREFFILE-REC.
           05 FD-XREF-CARD-NUM    PIC X(16).
           05 FD-XREF-DATA        PIC X(34).
       FD  CUST-FILE.
       01  FD-CUSTFILE-REC.
           05 FD-CUST-ID          PIC X(09).
           05 FD-CUST-DATA        PIC X(491).
       FD  ACCT-FILE.
       01  FD-ACCTFILE-REC.
           05 FD-ACCT-ID          PIC 9(11).
           05 FD-ACCT-DATA        PIC X(289).
       WORKING-STORAGE SECTION.
       01  IN-STATUS              PIC XX.
       01  OUT-STATUS             PIC XX.
       01  WS-EOF                 PIC X VALUE 'N'.
       01  WS-COUNT               PIC 9(6).
       PROCEDURE DIVISION.
           PERFORM 1000-LOAD-TRNX.
           PERFORM 2000-LOAD-XREF.
           PERFORM 3000-LOAD-CUST.
           PERFORM 4000-LOAD-ACCT.
           STOP RUN.

       1000-LOAD-TRNX.
           MOVE 'N' TO WS-EOF
           MOVE 0 TO WS-COUNT
           OPEN INPUT TRNX-IN
           OPEN OUTPUT TRNX-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ TRNX-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE TRNX-IN-REC TO FD-TRNXFILE-REC
                       WRITE FD-TRNXFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE TRNX-IN TRNX-FILE
           DISPLAY 'CBSTM03LOAD: TRNX RECORDS = ' WS-COUNT.

       2000-LOAD-XREF.
           MOVE 'N' TO WS-EOF
           MOVE 0 TO WS-COUNT
           OPEN INPUT XREF-IN
           OPEN OUTPUT XREF-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ XREF-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE XREF-IN-REC TO FD-XREFFILE-REC
                       WRITE FD-XREFFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE XREF-IN XREF-FILE
           DISPLAY 'CBSTM03LOAD: XREF RECORDS = ' WS-COUNT.

       3000-LOAD-CUST.
           MOVE 'N' TO WS-EOF
           MOVE 0 TO WS-COUNT
           OPEN INPUT CUST-IN
           OPEN OUTPUT CUST-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ CUST-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE CUST-IN-REC TO FD-CUSTFILE-REC
                       WRITE FD-CUSTFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE CUST-IN CUST-FILE
           DISPLAY 'CBSTM03LOAD: CUST RECORDS = ' WS-COUNT.

       4000-LOAD-ACCT.
           MOVE 'N' TO WS-EOF
           MOVE 0 TO WS-COUNT
           OPEN INPUT ACCT-IN
           OPEN OUTPUT ACCT-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ ACCT-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE ACCT-IN-REC TO FD-ACCTFILE-REC
                       WRITE FD-ACCTFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE ACCT-IN ACCT-FILE
           DISPLAY 'CBSTM03LOAD: ACCT RECORDS = ' WS-COUNT.
