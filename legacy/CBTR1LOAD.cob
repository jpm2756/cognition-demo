      ******************************************************************
      * CBTR1LOAD - stages the small ASCII fixtures for CBTRN01C into
      * the INDEXED (KSDS) files the unmodified program expects
      * (CUSTFILE, XREFFILE, CARDFILE, ACCTFILE, TRANFILE). The daily
      * transaction file (DALYTRAN) is a plain SEQUENTIAL file read
      * directly by CBTRN01C, so it is not staged here. This replaces
      * the mainframe IDCAMS REPRO steps for off-platform runs.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBTR1LOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT XREF-IN ASSIGN TO "cbtrn01c_xref.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-STATUS.
           SELECT XREF-OUT ASSIGN TO XREFFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS XO-CARD-NUM
                  FILE STATUS  IS WS-STATUS.

           SELECT ACCT-IN ASSIGN TO "cbtrn01c_acct.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-STATUS.
           SELECT ACCT-OUT ASSIGN TO ACCTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS AO-ACCT-ID
                  FILE STATUS  IS WS-STATUS.

           SELECT CARD-IN ASSIGN TO "cbtrn01c_card.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-STATUS.
           SELECT CARD-OUT ASSIGN TO CARDFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS CO-CARD-NUM
                  FILE STATUS  IS WS-STATUS.

           SELECT CUST-IN ASSIGN TO "cbtrn01c_cust.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-STATUS.
           SELECT CUST-OUT ASSIGN TO CUSTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS UO-CUST-ID
                  FILE STATUS  IS WS-STATUS.

           SELECT TRAN-IN ASSIGN TO "cbtrn01c_tran.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-STATUS.
           SELECT TRAN-OUT ASSIGN TO TRANFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS TO-TRANS-ID
                  FILE STATUS  IS WS-STATUS.
       DATA DIVISION.
       FILE SECTION.
       FD  XREF-IN.
       01  XI-REC                 PIC X(50).
       FD  XREF-OUT.
       01  XO-REC.
           05 XO-CARD-NUM         PIC X(16).
           05 XO-DATA             PIC X(34).
       FD  ACCT-IN.
       01  AI-REC                 PIC X(300).
       FD  ACCT-OUT.
       01  AO-REC.
           05 AO-ACCT-ID          PIC 9(11).
           05 AO-DATA             PIC X(289).
       FD  CARD-IN.
       01  CI-REC                 PIC X(150).
       FD  CARD-OUT.
       01  CO-REC.
           05 CO-CARD-NUM         PIC X(16).
           05 CO-DATA             PIC X(134).
       FD  CUST-IN.
       01  UI-REC                 PIC X(500).
       FD  CUST-OUT.
       01  UO-REC.
           05 UO-CUST-ID          PIC 9(09).
           05 UO-DATA             PIC X(491).
       FD  TRAN-IN.
       01  TI-REC                 PIC X(350).
       FD  TRAN-OUT.
       01  TO-REC.
           05 TO-TRANS-ID         PIC X(16).
           05 TO-DATA             PIC X(334).
       WORKING-STORAGE SECTION.
       01  WS-STATUS              PIC XX.
       01  WS-EOF                 PIC X VALUE 'N'.
       PROCEDURE DIVISION.
           PERFORM LOAD-XREF.
           PERFORM LOAD-ACCT.
           PERFORM LOAD-CARD.
           PERFORM LOAD-CUST.
           PERFORM LOAD-TRAN.
           DISPLAY 'CBTR1LOAD: FIXTURES LOADED'.
           STOP RUN.

       LOAD-XREF.
           MOVE 'N' TO WS-EOF
           OPEN INPUT XREF-IN
           OPEN OUTPUT XREF-OUT
           PERFORM UNTIL WS-EOF = 'Y'
               READ XREF-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE XI-REC TO XO-REC
                       WRITE XO-REC
               END-READ
           END-PERFORM
           CLOSE XREF-IN XREF-OUT
           EXIT.

       LOAD-ACCT.
           MOVE 'N' TO WS-EOF
           OPEN INPUT ACCT-IN
           OPEN OUTPUT ACCT-OUT
           PERFORM UNTIL WS-EOF = 'Y'
               READ ACCT-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE AI-REC TO AO-REC
                       WRITE AO-REC
               END-READ
           END-PERFORM
           CLOSE ACCT-IN ACCT-OUT
           EXIT.

       LOAD-CARD.
           MOVE 'N' TO WS-EOF
           OPEN INPUT CARD-IN
           OPEN OUTPUT CARD-OUT
           PERFORM UNTIL WS-EOF = 'Y'
               READ CARD-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE CI-REC TO CO-REC
                       WRITE CO-REC
               END-READ
           END-PERFORM
           CLOSE CARD-IN CARD-OUT
           EXIT.

       LOAD-CUST.
           MOVE 'N' TO WS-EOF
           OPEN INPUT CUST-IN
           OPEN OUTPUT CUST-OUT
           PERFORM UNTIL WS-EOF = 'Y'
               READ CUST-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE UI-REC TO UO-REC
                       WRITE UO-REC
               END-READ
           END-PERFORM
           CLOSE CUST-IN CUST-OUT
           EXIT.

       LOAD-TRAN.
           MOVE 'N' TO WS-EOF
           OPEN INPUT TRAN-IN
           OPEN OUTPUT TRAN-OUT
           PERFORM UNTIL WS-EOF = 'Y'
               READ TRAN-IN
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END
                       MOVE TI-REC TO TO-REC
                       WRITE TO-REC
               END-READ
           END-PERFORM
           CLOSE TRAN-IN TRAN-OUT
           EXIT.
