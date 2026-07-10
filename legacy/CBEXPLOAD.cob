      ******************************************************************
      * CBEXPLOAD - stages the CardDemo ASCII extracts into the five
      * INDEXED (KSDS) files that the unmodified CBEXPORT batch program
      * reads: CUSTFILE, ACCTFILE, XREFFILE, TRANSACT and CARDFILE.
      * This replaces the mainframe IDCAMS REPRO steps for off-platform
      * runs. Records are loaded in ascending key order.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBEXPLOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT CUST-IN ASSIGN TO "custdata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT ACCT-IN ASSIGN TO "acctdata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT XREF-IN ASSIGN TO "cardxref.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT TRAN-IN ASSIGN TO "trandata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT CARD-IN ASSIGN TO "carddata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.

           SELECT CUST-OUT ASSIGN TO CUSTFILE
                  ORGANIZATION IS INDEXED ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS CUST-ID FILE STATUS IS WS-ST.
           SELECT ACCT-OUT ASSIGN TO ACCTFILE
                  ORGANIZATION IS INDEXED ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS ACCT-ID FILE STATUS IS WS-ST.
           SELECT XREF-OUT ASSIGN TO XREFFILE
                  ORGANIZATION IS INDEXED ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS XREF-CARD-NUM FILE STATUS IS WS-ST.
           SELECT TRAN-OUT ASSIGN TO TRANSACT
                  ORGANIZATION IS INDEXED ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS TRAN-ID FILE STATUS IS WS-ST.
           SELECT CARD-OUT ASSIGN TO CARDFILE
                  ORGANIZATION IS INDEXED ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS CARD-NUM FILE STATUS IS WS-ST.

       DATA DIVISION.
       FILE SECTION.
       FD  CUST-IN.
       01  CUST-IN-REC   PIC X(500).
       FD  ACCT-IN.
       01  ACCT-IN-REC   PIC X(300).
       FD  XREF-IN.
       01  XREF-IN-REC   PIC X(50).
       FD  TRAN-IN.
       01  TRAN-IN-REC   PIC X(350).
       FD  CARD-IN.
       01  CARD-IN-REC   PIC X(150).

       FD  CUST-OUT.
       COPY CVCUS01Y.
       FD  ACCT-OUT.
       COPY CVACT01Y.
       FD  XREF-OUT.
       COPY CVACT03Y.
       FD  TRAN-OUT.
       COPY CVTRA05Y.
       FD  CARD-OUT.
       COPY CVACT02Y.

       WORKING-STORAGE SECTION.
       01  WS-ST     PIC XX.
       01  WS-EOF    PIC X VALUE 'N'.

       PROCEDURE DIVISION.
       MAIN.
           PERFORM LOAD-CUST
           PERFORM LOAD-ACCT
           PERFORM LOAD-XREF
           PERFORM LOAD-TRAN
           PERFORM LOAD-CARD
           DISPLAY 'CBEXPLOAD: DONE'
           STOP RUN.

       LOAD-CUST.
           OPEN INPUT CUST-IN OPEN OUTPUT CUST-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ CUST-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE CUST-IN-REC TO CUSTOMER-RECORD
                       WRITE CUSTOMER-RECORD
               END-READ
           END-PERFORM
           CLOSE CUST-IN CUST-OUT.

       LOAD-ACCT.
           OPEN INPUT ACCT-IN OPEN OUTPUT ACCT-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ ACCT-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE ACCT-IN-REC TO ACCOUNT-RECORD
                       WRITE ACCOUNT-RECORD
               END-READ
           END-PERFORM
           CLOSE ACCT-IN ACCT-OUT.

       LOAD-XREF.
           OPEN INPUT XREF-IN OPEN OUTPUT XREF-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ XREF-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE XREF-IN-REC TO CARD-XREF-RECORD
                       WRITE CARD-XREF-RECORD
               END-READ
           END-PERFORM
           CLOSE XREF-IN XREF-OUT.

       LOAD-TRAN.
           OPEN INPUT TRAN-IN OPEN OUTPUT TRAN-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ TRAN-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE TRAN-IN-REC TO TRAN-RECORD
                       WRITE TRAN-RECORD
               END-READ
           END-PERFORM
           CLOSE TRAN-IN TRAN-OUT.

       LOAD-CARD.
           OPEN INPUT CARD-IN OPEN OUTPUT CARD-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ CARD-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE CARD-IN-REC TO CARD-RECORD
                       WRITE CARD-RECORD
               END-READ
           END-PERFORM
           CLOSE CARD-IN CARD-OUT.
