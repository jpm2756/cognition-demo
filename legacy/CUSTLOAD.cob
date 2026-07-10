      ******************************************************************
      * CUSTLOAD - loads the CardDemo ASCII customer extract
      * (custdata.txt, fixed 500-byte records) into the INDEXED (KSDS)
      * CUSTFILE that the unmodified CBCUS01C expects. This replaces the
      * mainframe IDCAMS REPRO step for off-platform runs.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CUSTLOAD.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO "custdata.txt"
                  ORGANIZATION IS LINE SEQUENTIAL
                  FILE STATUS IS IN-STATUS.
           SELECT CUSTFILE-FILE ASSIGN TO CUSTFILE
                  ORGANIZATION IS INDEXED
                  ACCESS MODE  IS SEQUENTIAL
                  RECORD KEY   IS FD-CUST-ID
                  FILE STATUS  IS OUT-STATUS.
       DATA DIVISION.
       FILE SECTION.
       FD  IN-FILE.
       01  IN-REC                 PIC X(500).
       FD  CUSTFILE-FILE.
       01  FD-CUSTFILE-REC.
           05 FD-CUST-ID          PIC 9(09).
           05 FD-CUST-DATA        PIC X(491).
       WORKING-STORAGE SECTION.
       01  IN-STATUS              PIC XX.
       01  OUT-STATUS             PIC XX.
       01  WS-COUNT               PIC 9(6) VALUE 0.
       PROCEDURE DIVISION.
           OPEN INPUT IN-FILE
           OPEN OUTPUT CUSTFILE-FILE
           PERFORM UNTIL IN-STATUS = '10'
               READ IN-FILE
                   AT END
                       CONTINUE
                   NOT AT END
                       MOVE IN-REC TO FD-CUSTFILE-REC
                       WRITE FD-CUSTFILE-REC
                       ADD 1 TO WS-COUNT
               END-READ
           END-PERFORM
           CLOSE IN-FILE CUSTFILE-FILE
           DISPLAY 'CUSTLOAD: LOADED ' WS-COUNT ' CUSTOMER RECORDS'
           STOP RUN.
