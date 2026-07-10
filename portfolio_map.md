# CardDemo Batch Portfolio — Discovery Map (Act 1 → Act 2)

*Auto-generated inventory of the CardDemo batch (`CB*`) tier — the "map/reduce" discovery pass the demo runs across the portfolio before any modernization. One row = one candidate Devin session.*

| Program | Function | LOC | Files | External deps | Complexity | Status |
|---|---|---:|:--:|---|:--:|---|
| **CBACT01C** | Read account master; print + derive report records | 430 | 4 | COBDATFT, CEE3ABD | Med | ✅ **Modernized (parity green)** |
| [CBACT02C](https://app.devin.ai/sessions/2fd22131f4f64dbebb8b06131dae5702) | Read & print card data file | 178 | 1 | CEE3ABD | Low | 🔄 In progress (fleet) |
| [CBACT03C](https://app.devin.ai/sessions/306fe823e3594da2a49d3fc93d0b00d9) | Read & print account cross-reference file | 178 | 1 | CEE3ABD | Low | 🔄 In progress (fleet) |
| [CBCUS01C](https://app.devin.ai/sessions/6a59d73581ed41f89eb030582bc0a30d) | Read & print customer data file | 178 | 1 | CEE3ABD | Low | 🔄 In progress (fleet) |
| [CBACT04C](https://app.devin.ai/sessions/5c8a4edeca3f48ec8a53bcf5072d8b8e) | Interest calculator | 652 | 5 | CEE3ABD | High | 🔄 In progress (fleet) |
| [CBTRN01C](https://app.devin.ai/sessions/a4f4fb78f51945ebabb75afa23013b33) | Post daily transactions (validation) | 494 | 6 | CEE3ABD | High | 🔄 In progress (fleet) |
| [CBTRN02C](https://app.devin.ai/sessions/db910be83e364bf48851367fe46be73f) | Post daily transactions (category balance) | 731 | 6 | CEE3ABD | High | 🔄 In progress (fleet) |
| [CBTRN03C](https://app.devin.ai/sessions/fdad8d5c266f467682a5f49a7bc27be3) | Print transaction detail report | 649 | 6 | CEE3ABD | Med | 🔄 In progress (fleet) |
| [CBSTM03A](https://app.devin.ai/sessions/abbcbfad47dc4521bd460db90223bc9a) | Print account statements from transaction data | 924 | 2 | CBSTM03B, CEE3ABD | High | 🔄 In progress (fleet, unit w/ CBSTM03B) |
| [CBSTM03B](https://app.devin.ai/sessions/abbcbfad47dc4521bd460db90223bc9a) | Statement sub-program (file processing) | 230 | 4 | — | Med | 🔄 In progress (fleet, unit w/ CBSTM03A) |
| [CBEXPORT](https://app.devin.ai/sessions/33dcc650cca042b4bc943a95e3e38e7a) | Export customer data for branch migration | 582 | 6 | CEE3ABD | Med | 🔄 In progress (fleet) |
| [CBIMPORT](https://app.devin.ai/sessions/5d5eb0c32ab44fe798c19da5dbd2659b) | Import customer data from branch export | 487 | 7 | CEE3ABD | Med | 🔄 In progress (fleet) |

**Totals:** 12 batch programs, ~5,700 LOC. **Reduce insights:**
- **Shared dependency:** every program calls `CEE3ABD` (LE abend) — modernize once as a shared runtime shim, reuse across the fleet (a factory economy-of-scale point).
- **Quick wins:** the three 178-line file-print programs (CBACT02C/03C, CBCUS01C) are near-identical patterns — ideal for a "one session finishes in minutes" moment.
- **Meaty business logic:** CBACT04C (interest), CBTRN02C (posting), CBSTM03A (statements) carry the real financial rules — the strongest parity stories.
- **Data pairs:** CBEXPORT/CBIMPORT are a natural round-trip test.

**Suggested demo fleet (parallel Devin sessions):** CBACT01C (done, flagship), CBACT04C, CBTRN02C, CBTRN03C, CBSTM03A — plus a 178-line quick win to show a fast completion.
