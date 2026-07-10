# CardDemo Batch Portfolio — Discovery Map (Act 1 → Act 2)

*Auto-generated inventory of the CardDemo batch (`CB*`) tier — the "map/reduce" discovery pass the demo runs across the portfolio before any modernization. One row = one candidate Devin session.*

| Program | Function | LOC | Files | External deps | Complexity | Status |
|---|---|---:|:--:|---|:--:|---|
| **CBACT01C** | Read account master; print + derive report records | 430 | 4 | COBDATFT, CEE3ABD | Med | ✅ Modernized (parity green) — [PR #1](https://github.com/jpm2756/cognition-demo/pull/1) |
| CBACT02C | Read & print card data file | 178 | 1 | CEE3ABD | Low | ✅ Modernized (parity green) — [PR #6](https://github.com/jpm2756/cognition-demo/pull/6) |
| CBACT03C | Read & print account cross-reference file | 178 | 1 | CEE3ABD | Low | ✅ Modernized (parity green) — [PR #5](https://github.com/jpm2756/cognition-demo/pull/5) |
| CBCUS01C | Read & print customer data file | 178 | 1 | CEE3ABD | Low | ✅ Modernized (parity green) — [PR #4](https://github.com/jpm2756/cognition-demo/pull/4) |
| CBACT04C | Interest calculator | 652 | 5 | CEE3ABD | High | ✅ Modernized (parity green) — [PR #10](https://github.com/jpm2756/cognition-demo/pull/10) |
| CBTRN01C | Post daily transactions (validation) | 494 | 6 | CEE3ABD | High | ✅ Modernized (parity green) — [PR #9](https://github.com/jpm2756/cognition-demo/pull/9) |
| CBTRN02C | Post daily transactions (category balance) | 731 | 6 | CEE3ABD | High | ✅ Modernized (parity green) — [PR #8](https://github.com/jpm2756/cognition-demo/pull/8) |
| CBTRN03C | Print transaction detail report | 649 | 6 | CEE3ABD | Med | ✅ Modernized (parity green) — [PR #7](https://github.com/jpm2756/cognition-demo/pull/7) |
| CBSTM03A | Print account statements from transaction data | 924 | 2 | CBSTM03B, CEE3ABD | High | ✅ Modernized (parity green, unit w/ CBSTM03B) — [PR #12](https://github.com/jpm2756/cognition-demo/pull/12) |
| CBSTM03B | Statement sub-program (file processing) | 230 | 4 | — | Med | ✅ Modernized (parity green, unit w/ CBSTM03A) — [PR #12](https://github.com/jpm2756/cognition-demo/pull/12) |
| CBEXPORT | Export customer data for branch migration | 582 | 6 | CEE3ABD | Med | ✅ Modernized (parity green) — [PR #11](https://github.com/jpm2756/cognition-demo/pull/11) |
| CBIMPORT | Import customer data from branch export | 487 | 7 | CEE3ABD | Med | ✅ Modernized (parity green) — [PR #13](https://github.com/jpm2756/cognition-demo/pull/13) |

**Totals:** 12 batch programs, ~5,700 LOC. **Reduce insights:**
- **Shared dependency:** every program calls `CEE3ABD` (LE abend) — modernize once as a shared runtime shim, reuse across the fleet (a factory economy-of-scale point).
- **Quick wins:** the three 178-line file-print programs (CBACT02C/03C, CBCUS01C) are near-identical patterns — ideal for a "one session finishes in minutes" moment.
- **Meaty business logic:** CBACT04C (interest), CBTRN02C (posting), CBSTM03A (statements) carry the real financial rules — the strongest parity stories.
- **Data pairs:** CBEXPORT/CBIMPORT are a natural round-trip test.

**Suggested demo fleet (parallel Devin sessions):** CBACT01C (done, flagship), CBACT04C, CBTRN02C, CBTRN03C, CBSTM03A — plus a 178-line quick win to show a fast completion.
