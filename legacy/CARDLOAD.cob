      ******************************************************************
      * CARDLOAD - loads the CardDemo ASCII card extract
      * (carddata.txt, fixed 150-byte records) into the INDEXED (KSDS)
      * CARDFILE that the unmodified CBACT02C expects. This replaces the
      * mainframe IDCAMS REPRO step for off-platform runs.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CARDLOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO "carddata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.
           SELECT CARDFILE-FILE ASSIGN TO CARDFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-CARD-NUM
                  FILE STATUS  IS OUT-STATUS.
       DATA DIVISION.
       FILE SECTION.
       FD  IN-FILE.
       01  IN-REC                 PIC X(150).
       FD  CARDFILE-FILE.
       01  FD-CARDFILE-REC.
           05 FD-CARD-NUM         PIC X(16).
           05 FD-CARD-DATA        PIC X(134).
       WORKING-STORAGE SECTION.
       01  IN-STATUS              PIC XX.
       01  OUT-STATUS             PIC XX.
       01  WS-COUNT               PIC 9(6) VALUE 0.
       PROCEDURE DIVISION.
           OPEN INPUT IN-FILE
           OPEN OUTPUT CARDFILE-FILE
           PERFORM UNTIL IN-STATUS = '10'
               READ IN-FILE
                   AT END
                       CONTINUE
                   NOT AT END
                       MOVE IN-REC TO FD-CARDFILE-REC
                       WRITE FD-CARDFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE IN-FILE CARDFILE-FILE
           DISPLAY 'CARDLOAD: LOADED ' WS-COUNT ' CARD RECORDS'
           STOP RUN.
