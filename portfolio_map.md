# CardDemo Batch Portfolio — Discovery Map (Act 1 → Act 2)

*Auto-generated inventory of the CardDemo batch (`CB*`) tier — the "map/reduce" discovery pass the demo runs across the portfolio before any modernization. One row = one candidate Devin session.*

| Program | Function | LOC | Files | External deps | Complexity | Status |
|---|---|---:|:--:|---|:--:|---|
| **CBACT01C** | Read account master; print + derive report records | 430 | 4 | COBDATFT, CEE3ABD | Med | ✅ **Modernized (parity green)** |
| CBACT02C | Read & print card data file | 178 | 1 | CEE3ABD | Low | Analyzed — candidate |
| CBACT03C | Read & print account cross-reference file | 178 | 1 | CEE3ABD | Low | Analyzed — candidate |
| CBCUS01C | Read & print customer data file | 178 | 1 | CEE3ABD | Low | Analyzed — candidate |
| CBACT04C | Interest calculator | 652 | 5 | CEE3ABD | High | Analyzed — candidate |
| CBTRN01C | Post daily transactions (validation) | 494 | 6 | CEE3ABD | High | Analyzed — candidate |
| CBTRN02C | Post daily transactions (category balance) | 731 | 6 | CEE3ABD | High | Analyzed — candidate |
| CBTRN03C | Print transaction detail report | 649 | 6 | CEE3ABD | Med | Analyzed — candidate |
| CBSTM03A | Print account statements from transaction data | 924 | 2 | CBSTM03B, CEE3ABD | High | Analyzed — candidate |
| CBSTM03B | Statement sub-program (file processing) | 230 | 4 | — | Med | Analyzed — candidate |
| CBEXPORT | Export customer data for branch migration | 582 | 6 | CEE3ABD | Med | Analyzed — candidate |
| CBIMPORT | Import customer data from branch export | 487 | 7 | CEE3ABD | Med | Analyzed — candidate |

**Totals:** 12 batch programs, ~5,700 LOC. **Reduce insights:**
- **Shared dependency:** every program calls `CEE3ABD` (LE abend) — modernize once as a shared runtime shim, reuse across the fleet (a factory economy-of-scale point).
- **Quick wins:** the three 178-line file-print programs (CBACT02C/03C, CBCUS01C) are near-identical patterns — ideal for a "one session finishes in minutes" moment.
- **Meaty business logic:** CBACT04C (interest), CBTRN02C (posting), CBSTM03A (statements) carry the real financial rules — the strongest parity stories.
- **Data pairs:** CBEXPORT/CBIMPORT are a natural round-trip test.

**Suggested demo fleet (parallel Devin sessions):** CBACT01C (done, flagship), CBACT04C, CBTRN02C, CBTRN03C, CBSTM03A — plus a 178-line quick win to show a fast completion.
