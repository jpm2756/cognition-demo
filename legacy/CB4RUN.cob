      ******************************************************************
      * CB4RUN - off-platform job-step driver for the unmodified
      * CBACT04C. On z/OS the program is invoked by JCL (INTCALC.jcl)
      * with PARM='2022071800'; CBACT04C receives it through its
      * LINKAGE EXTERNAL-PARMS (halfword length + 10-char run date).
      * GnuCOBOL will not build a PROCEDURE DIVISION USING program as a
      * main entry point, so this thin driver supplies the same PARM and
      * CALLs CBACT04C - it does NOT touch the business logic.
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CB4RUN.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  EXTERNAL-PARMS.
           05  PARM-LENGTH        PIC S9(04) COMP.
           05  PARM-DATE          PIC X(10).
       PROCEDURE DIVISION.
           MOVE 10           TO PARM-LENGTH
           MOVE '2022071800' TO PARM-DATE
           CALL 'CBACT04C' USING EXTERNAL-PARMS
           STOP RUN.
