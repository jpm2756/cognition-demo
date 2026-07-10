      ******************************************************************
      * CBTRN02CLOAD - stages deterministic flat-file fixtures into the
      * indexed files expected by the unmodified CBTRN02C program.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBTRN02CLOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT ACCT-IN ASSIGN TO "cbtrn02c_acctdata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL.
           SELECT ACCT-OUT ASSIGN TO ACCTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS ACCT-OUT-ID.
           SELECT XREF-IN ASSIGN TO "cbtrn02c_cardxref.txt"
                  ORGANIZATION IS LINE SEQUENTIAL.
           SELECT XREF-OUT ASSIGN TO XREFFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS XREF-OUT-CARD-NUM.
           SELECT TCAT-IN ASSIGN TO "cbtrn02c_tcatbal.txt"
                  ORGANIZATION IS LINE SEQUENTIAL.
           SELECT TCAT-OUT ASSIGN TO TCATBALF
                  ORGANIZATION IS INDEXED
                  ACCESS MODE IS SEQUENTIAL
                  RECORD KEY IS TCAT-OUT-KEY.
       DATA DIVISION.
       FILE SECTION.
       FD  ACCT-IN.
       01  ACCT-IN-REC                       PIC X(300).
       FD  ACCT-OUT.
       01  ACCT-OUT-REC.
           05 ACCT-OUT-ID                    PIC 9(11).
           05 ACCT-OUT-DATA                  PIC X(289).
       FD  XREF-IN.
       01  XREF-IN-REC                       PIC X(50).
       FD  XREF-OUT.
       01  XREF-OUT-REC.
           05 XREF-OUT-CARD-NUM              PIC X(16).
           05 XREF-OUT-DATA                  PIC X(34).
       FD  TCAT-IN.
       01  TCAT-IN-REC                       PIC X(50).
       FD  TCAT-OUT.
       01  TCAT-OUT-REC.
           05 TCAT-OUT-KEY.
              10 TCAT-OUT-ACCT-ID            PIC 9(11).
              10 TCAT-OUT-TYPE-CD            PIC X(02).
              10 TCAT-OUT-CAT-CD             PIC 9(04).
           05 TCAT-OUT-DATA                  PIC X(33).
       WORKING-STORAGE SECTION.
       01  WS-ACCT-EOF                       PIC X VALUE 'N'.
       01  WS-XREF-EOF                       PIC X VALUE 'N'.
       01  WS-TCAT-EOF                       PIC X VALUE 'N'.
       01  WS-ACCT-COUNT                     PIC 9(6) VALUE 0.
       01  WS-XREF-COUNT                     PIC 9(6) VALUE 0.
       01  WS-TCAT-COUNT                     PIC 9(6) VALUE 0.
       PROCEDURE DIVISION.
           OPEN INPUT ACCT-IN XREF-IN TCAT-IN
           OPEN OUTPUT ACCT-OUT XREF-OUT TCAT-OUT

           PERFORM UNTIL WS-ACCT-EOF = 'Y'
               READ ACCT-IN
                   AT END
                       MOVE 'Y' TO WS-ACCT-EOF
                   NOT AT END
                       MOVE ACCT-IN-REC TO ACCT-OUT-REC
                       WRITE ACCT-OUT-REC
                       ADD 1 TO WS-ACCT-COUNT
               END-READ
           END-PERFORM

           PERFORM UNTIL WS-XREF-EOF = 'Y'
               READ XREF-IN
                   AT END
                       MOVE 'Y' TO WS-XREF-EOF
                   NOT AT END
                       MOVE XREF-IN-REC TO XREF-OUT-REC
                       WRITE XREF-OUT-REC
                       ADD 1 TO WS-XREF-COUNT
               END-READ
           END-PERFORM

           PERFORM UNTIL WS-TCAT-EOF = 'Y'
               READ TCAT-IN
                   AT END
                       MOVE 'Y' TO WS-TCAT-EOF
                   NOT AT END
                       MOVE TCAT-IN-REC TO TCAT-OUT-REC
                       WRITE TCAT-OUT-REC
                       ADD 1 TO WS-TCAT-COUNT
               END-READ
           END-PERFORM

           CLOSE ACCT-IN ACCT-OUT XREF-IN XREF-OUT TCAT-IN TCAT-OUT
           DISPLAY 'CBTRN02CLOAD: LOADED ' WS-ACCT-COUNT
                   ' ACCOUNT RECORDS'
           DISPLAY 'CBTRN02CLOAD: LOADED ' WS-XREF-COUNT
                   ' XREF RECORDS'
           DISPLAY 'CBTRN02CLOAD: LOADED ' WS-TCAT-COUNT
                   ' CATEGORY BALANCE RECORDS'
           STOP RUN.
