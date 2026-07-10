      ******************************************************************
      * XREFLOAD - loads the CardDemo ASCII card cross-reference extract
      * (cardxref.txt, fixed 50-byte records) into the INDEXED (KSDS)
      * XREFFILE that the unmodified CBACT03C expects. This replaces the
      * mainframe IDCAMS REPRO step for off-platform runs.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. XREFLOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO "cardxref.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.
           SELECT XREFFILE-FILE ASSIGN TO XREFFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-XREF-CARD-NUM
                  FILE STATUS  IS OUT-STATUS.
       DATA DIVISION.
       FILE SECTION.
       FD  IN-FILE.
       01  IN-REC                 PIC X(50).
       FD  XREFFILE-FILE.
       01  FD-XREFFILE-REC.
           05 FD-XREF-CARD-NUM    PIC X(16).
           05 FD-XREF-DATA        PIC X(34).
       WORKING-STORAGE SECTION.
       01  IN-STATUS              PIC XX.
       01  OUT-STATUS             PIC XX.
       01  WS-COUNT               PIC 9(6) VALUE 0.
       PROCEDURE DIVISION.
           OPEN INPUT IN-FILE
           OPEN OUTPUT XREFFILE-FILE
           PERFORM UNTIL IN-STATUS = '10'
               READ IN-FILE
                   AT END
                       CONTINUE
                   NOT AT END
                       MOVE IN-REC TO FD-XREFFILE-REC
                       WRITE FD-XREFFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE IN-FILE XREFFILE-FILE
           DISPLAY 'XREFLOAD: LOADED ' WS-COUNT ' XREF RECORDS'
           STOP RUN.
