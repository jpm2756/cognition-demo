      ******************************************************************
      * COBDATFT - COBOL stub replacing the mainframe assembler date
      * formatter used by CardDemo batch programs. Implements the same
      * behavior as asm/COBDATFT.asm for the two supported conversions:
      *   TYPE=1 (YYYYMMDD in)  + OUTTYPE=1 -> YYYY-MM-DD
      *   TYPE=2 (YYYY-MM-DD in)+ OUTTYPE=2 -> YYYYMMDD
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. COBDATFT.
       DATA DIVISION.
       LINKAGE SECTION.
       COPY CODATECN.
       PROCEDURE DIVISION USING CODATECN-REC.
           MOVE SPACES TO CODATECN-ERROR-MSG
           EVALUATE TRUE
               WHEN CODATECN-TYPE = '1'
                   IF CODATECN-OUTTYPE = '2'
                       MOVE 'INVALID INPUT' TO CODATECN-ERROR-MSG
                   ELSE
                       MOVE CODATECN-INP-DATE(1:4)
                            TO CODATECN-0UT-DATE(1:4)
                       MOVE '-' TO CODATECN-0UT-DATE(5:1)
                       MOVE CODATECN-INP-DATE(5:2)
                            TO CODATECN-0UT-DATE(6:2)
                       MOVE '-' TO CODATECN-0UT-DATE(8:1)
                       MOVE CODATECN-INP-DATE(7:2)
                            TO CODATECN-0UT-DATE(9:2)
                   END-IF
               WHEN CODATECN-TYPE = '2'
                   IF CODATECN-OUTTYPE = '1'
                       MOVE 'INVALID INPUT' TO CODATECN-ERROR-MSG
                   ELSE
                       MOVE CODATECN-INP-DATE(1:4)
                            TO CODATECN-0UT-DATE(1:4)
                       MOVE CODATECN-INP-DATE(6:2)
                            TO CODATECN-0UT-DATE(5:2)
                       MOVE CODATECN-INP-DATE(9:2)
                            TO CODATECN-0UT-DATE(7:2)
                   END-IF
               WHEN OTHER
                   MOVE 'INVALID INPUT' TO CODATECN-ERROR-MSG
           END-EVALUATE
           GOBACK.
