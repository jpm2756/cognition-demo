      ******************************************************************
      * CB4LOAD - stages the CBACT04C ASCII fixtures into the INDEXED
      * (KSDS) files that the unmodified CBACT04C expects: ACCTFILE,
      * TCATBALF, DISCGRP and XREFFILE (the last with an ALTERNATE key
      * on ACCT-ID, matching CBACT04C's SELECT). This replaces the
      * mainframe IDCAMS REPRO steps for off-platform runs.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CB4LOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT ACCT-IN ASSIGN TO "cbact04c_acct.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT ACCT-OUT ASSIGN TO ACCTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS AO-ACCT-ID
                  FILE STATUS  IS WS-ST.

           SELECT TCAT-IN ASSIGN TO "cbact04c_tcatbal.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT TCAT-OUT ASSIGN TO TCATBALF
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS TO-TRAN-CAT-KEY
                  FILE STATUS  IS WS-ST.

           SELECT DISC-IN ASSIGN TO "cbact04c_discgrp.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT DISC-OUT ASSIGN TO DISCGRP
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS DO-DISCGRP-KEY
                  FILE STATUS  IS WS-ST.

           SELECT XREF-IN ASSIGN TO "cbact04c_xref.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS WS-ST.
           SELECT XREF-OUT ASSIGN TO XREFFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS XO-CARD-NUM
                  ALTERNATE RECORD KEY IS XO-ACCT-ID
                  FILE STATUS  IS WS-ST.
       DATA DIVISION.
       FILE SECTION.
       FD  ACCT-IN.
       01  ACCT-IN-REC            PIC X(300).
       FD  ACCT-OUT.
       01  ACCT-OUT-REC.
           05 AO-ACCT-ID          PIC 9(11).
           05 AO-ACCT-DATA        PIC X(289).
       FD  TCAT-IN.
       01  TCAT-IN-REC            PIC X(50).
       FD  TCAT-OUT.
       01  TCAT-OUT-REC.
           05 TO-TRAN-CAT-KEY.
              10 TO-ACCT-ID       PIC 9(11).
              10 TO-TYPE-CD       PIC X(02).
              10 TO-CD            PIC 9(04).
           05 TO-DATA             PIC X(33).
       FD  DISC-IN.
       01  DISC-IN-REC            PIC X(50).
       FD  DISC-OUT.
       01  DISC-OUT-REC.
           05 DO-DISCGRP-KEY.
              10 DO-GROUP-ID      PIC X(10).
              10 DO-TYPE-CD       PIC X(02).
              10 DO-CAT-CD        PIC 9(04).
           05 DO-DATA             PIC X(34).
       FD  XREF-IN.
       01  XREF-IN-REC            PIC X(50).
       FD  XREF-OUT.
       01  XREF-OUT-REC.
           05 XO-CARD-NUM         PIC X(16).
           05 XO-CUST-ID          PIC 9(09).
           05 XO-ACCT-ID          PIC 9(11).
           05 XO-FILLER           PIC X(14).
       WORKING-STORAGE SECTION.
       01  WS-ST                  PIC XX.
       01  WS-EOF                 PIC X VALUE 'N'.
       PROCEDURE DIVISION.
           OPEN INPUT ACCT-IN
           OPEN OUTPUT ACCT-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ ACCT-IN AT END MOVE 'Y' TO WS-EOF
                 NOT AT END
                   MOVE ACCT-IN-REC TO ACCT-OUT-REC
                   WRITE ACCT-OUT-REC
               END-READ
           END-PERFORM
           CLOSE ACCT-IN ACCT-OUT

           OPEN INPUT TCAT-IN
           OPEN OUTPUT TCAT-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ TCAT-IN AT END MOVE 'Y' TO WS-EOF
                 NOT AT END
                   MOVE TCAT-IN-REC TO TCAT-OUT-REC
                   WRITE TCAT-OUT-REC
               END-READ
           END-PERFORM
           CLOSE TCAT-IN TCAT-OUT

           OPEN INPUT DISC-IN
           OPEN OUTPUT DISC-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ DISC-IN AT END MOVE 'Y' TO WS-EOF
                 NOT AT END
                   MOVE DISC-IN-REC TO DISC-OUT-REC
                   WRITE DISC-OUT-REC
               END-READ
           END-PERFORM
           CLOSE DISC-IN DISC-OUT

           OPEN INPUT XREF-IN
           OPEN OUTPUT XREF-OUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ XREF-IN AT END MOVE 'Y' TO WS-EOF
                 NOT AT END
                   MOVE XREF-IN-REC TO XREF-OUT-REC
                   WRITE XREF-OUT-REC
               END-READ
           END-PERFORM
           CLOSE XREF-IN XREF-OUT

           DISPLAY 'CB4LOAD: INDEXED FIXTURES LOADED'
           STOP RUN.
