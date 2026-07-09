      ******************************************************************
      * ACCTLOAD - loads the CardDemo ASCII account extract
      * (acctdata.txt, fixed 300-byte records) into the INDEXED (KSDS)
      * ACCTFILE that the unmodified CBACT01C expects. This replaces the
      * mainframe IDCAMS REPRO step for off-platform runs.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. ACCTLOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO "acctdata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.
           SELECT ACCTFILE-FILE ASSIGN TO ACCTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-ACCT-ID
                  FILE STATUS  IS OUT-STATUS.
       DATA DIVISION.
       FILE SECTION.
       FD  IN-FILE.
       01  IN-REC                 PIC X(300).
       FD  ACCTFILE-FILE.
       01  FD-ACCTFILE-REC.
           05 FD-ACCT-ID          PIC 9(11).
           05 FD-ACCT-DATA        PIC X(289).
       WORKING-STORAGE SECTION.
       01  IN-STATUS              PIC XX.
       01  OUT-STATUS             PIC XX.
       01  WS-COUNT               PIC 9(6) VALUE 0.
       PROCEDURE DIVISION.
           OPEN INPUT IN-FILE
           OPEN OUTPUT ACCTFILE-FILE
           PERFORM UNTIL IN-STATUS = '10'
               READ IN-FILE
                   AT END
                       CONTINUE
                   NOT AT END
                       MOVE IN-REC TO FD-ACCTFILE-REC
                       WRITE FD-ACCTFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE IN-FILE ACCTFILE-FILE
           DISPLAY 'ACCTLOAD: LOADED ' WS-COUNT ' ACCOUNT RECORDS'
           STOP RUN.
