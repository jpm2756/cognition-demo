       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBTRN03LOAD.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-TRAN-FILE ASSIGN TO CBTRN03IN
              ORGANIZATION IS LINE SEQUENTIAL.
           SELECT OUT-TRAN-FILE ASSIGN TO TRANFILE
              ORGANIZATION IS SEQUENTIAL.
           SELECT IN-XREF-FILE ASSIGN TO CBTRN03XREFIN
              ORGANIZATION IS LINE SEQUENTIAL.
           SELECT OUT-XREF-FILE ASSIGN TO CARDXREF
              ORGANIZATION IS INDEXED
              ACCESS MODE IS DYNAMIC
              RECORD KEY IS OUT-XREF-CARD-NUM
              FILE STATUS IS OUT-XREF-STATUS.
           SELECT IN-TYPE-FILE ASSIGN TO CBTRN03TYPEIN
              ORGANIZATION IS LINE SEQUENTIAL.
           SELECT OUT-TYPE-FILE ASSIGN TO TRANTYPE
              ORGANIZATION IS INDEXED
              ACCESS MODE IS DYNAMIC
              RECORD KEY IS OUT-TRAN-TYPE
              FILE STATUS IS OUT-TYPE-STATUS.
           SELECT IN-CATG-FILE ASSIGN TO CBTRN03CATGIN
              ORGANIZATION IS LINE SEQUENTIAL.
           SELECT OUT-CATG-FILE ASSIGN TO TRANCATG
              ORGANIZATION IS INDEXED
              ACCESS MODE IS DYNAMIC
              RECORD KEY IS OUT-TRAN-CAT-KEY
              FILE STATUS IS OUT-CATG-STATUS.

       DATA DIVISION.
       FILE SECTION.
       FD IN-TRAN-FILE.
       01 IN-TRAN-REC PIC X(350).
       FD OUT-TRAN-FILE.
       01 OUT-TRAN-REC PIC X(350).

       FD IN-XREF-FILE.
       01 IN-XREF-REC PIC X(50).
       FD OUT-XREF-FILE.
       01 OUT-XREF-REC.
          05 OUT-XREF-CARD-NUM PIC X(16).
          05 OUT-XREF-DATA PIC X(34).

       FD IN-TYPE-FILE.
       01 IN-TYPE-REC PIC X(60).
       FD OUT-TYPE-FILE.
       01 OUT-TYPE-REC.
          05 OUT-TRAN-TYPE PIC X(02).
          05 OUT-TYPE-DATA PIC X(58).

       FD IN-CATG-FILE.
       01 IN-CATG-REC PIC X(60).
       FD OUT-CATG-FILE.
       01 OUT-CATG-REC.
          05 OUT-TRAN-CAT-KEY PIC X(06).
          05 OUT-CATG-DATA PIC X(54).

       WORKING-STORAGE SECTION.
       01 END-TRAN PIC X VALUE 'N'.
       01 END-XREF PIC X VALUE 'N'.
       01 END-TYPE PIC X VALUE 'N'.
       01 END-CATG PIC X VALUE 'N'.
       01 OUT-XREF-STATUS PIC XX.
       01 OUT-TYPE-STATUS PIC XX.
       01 OUT-CATG-STATUS PIC XX.

       PROCEDURE DIVISION.
           OPEN INPUT IN-TRAN-FILE
                OUTPUT OUT-TRAN-FILE
           PERFORM UNTIL END-TRAN = 'Y'
              READ IN-TRAN-FILE
                 AT END MOVE 'Y' TO END-TRAN
                 NOT AT END
                    MOVE IN-TRAN-REC TO OUT-TRAN-REC
                    WRITE OUT-TRAN-REC
              END-READ
           END-PERFORM
           CLOSE IN-TRAN-FILE OUT-TRAN-FILE

           OPEN INPUT IN-XREF-FILE
                OUTPUT OUT-XREF-FILE
           PERFORM UNTIL END-XREF = 'Y'
              READ IN-XREF-FILE
                 AT END MOVE 'Y' TO END-XREF
                 NOT AT END
                    MOVE IN-XREF-REC TO OUT-XREF-REC
                    WRITE OUT-XREF-REC
                       INVALID KEY
                          DISPLAY 'CARDXREF LOAD FAILED '
                             OUT-XREF-STATUS
                          STOP RUN RETURNING 1
                    END-WRITE
              END-READ
           END-PERFORM
           CLOSE IN-XREF-FILE OUT-XREF-FILE

           OPEN INPUT IN-TYPE-FILE
                OUTPUT OUT-TYPE-FILE
           PERFORM UNTIL END-TYPE = 'Y'
              READ IN-TYPE-FILE
                 AT END MOVE 'Y' TO END-TYPE
                 NOT AT END
                    MOVE IN-TYPE-REC TO OUT-TYPE-REC
                    WRITE OUT-TYPE-REC
                       INVALID KEY
                          DISPLAY 'TRANTYPE LOAD FAILED '
                             OUT-TYPE-STATUS
                          STOP RUN RETURNING 1
                    END-WRITE
              END-READ
           END-PERFORM
           CLOSE IN-TYPE-FILE OUT-TYPE-FILE

           OPEN INPUT IN-CATG-FILE
                OUTPUT OUT-CATG-FILE
           PERFORM UNTIL END-CATG = 'Y'
              READ IN-CATG-FILE
                 AT END MOVE 'Y' TO END-CATG
                 NOT AT END
                    MOVE IN-CATG-REC TO OUT-CATG-REC
                    WRITE OUT-CATG-REC
                       INVALID KEY
                          DISPLAY 'TRANCATG LOAD FAILED '
                             OUT-CATG-STATUS
                          STOP RUN RETURNING 1
                    END-WRITE
              END-READ
           END-PERFORM
           CLOSE IN-CATG-FILE OUT-CATG-FILE
           GOBACK.
