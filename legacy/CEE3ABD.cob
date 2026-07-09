      ******************************************************************
      * CEE3ABD - stub for the z/OS Language Environment abend service.
      * On a mainframe this abends the task; off-platform we surface the
      * abend code and stop with a non-zero status so failures are loud.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CEE3ABD.
       DATA DIVISION.
       LINKAGE SECTION.
       01  ABCODE  PIC S9(9) BINARY.
       01  TIMING  PIC S9(9) BINARY.
       PROCEDURE DIVISION USING ABCODE TIMING.
           DISPLAY 'CEE3ABD: PROGRAM ABEND, CODE=' ABCODE
           MOVE 8 TO RETURN-CODE
           STOP RUN.
