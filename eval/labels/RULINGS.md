# TM-1 labelling rulings

These rulings apply to all 20 rows of `eval/labels/gold.csv`. `RESULTS.md` cites them. The owner (Anthony) decided them on Nov 14, 2026, before the parsing evaluation was run. The alias table and the out-of-scope list were not changed after the labels were seen.

| Id | Ruling | Effect on the draft |
|---|---|---|
| R1 | Versions and editions of the same product fold into one skill (guide rule 4). Windows desktop versions and Windows NT become `windows`; server editions stay `windows server`. MS-DOS and PC DOS become `dos`. Windows Phone and Windows Mobile are separate products, so they stay separate. | 10089434, 10247517, 10549585, 10553553, 11580408, 12334140 |
| R2 | Apple's iWork apps use their full product names: `apple pages`, `apple numbers`, `apple keynote`. | 10247517, 10265057 |
| R3 | A named software product the résumé says the candidate used counts, however niche. This includes in-house or proprietary systems the résumé presents as software (wds, lss, cavs ii, promis, omd), DoD tools (acas), and business software such as ERP, payroll and HR systems. | Kept as drafted: 10219099, 10694288, 10840430, 11441764, 11580408 |
| R4 | `basic` counts when it means the BASIC programming language ("IBM Basic Programming"). | Kept: 12334140 |
| R5 | A hardware or network vendor counts as a skill when the résumé says the candidate worked with that vendor's equipment, for example "Cisco routers". A vendor that appears only in a certificate title does not count. | Kept as drafted |
| R6 | Full product names over acronyms (guide rule 4), as drafted. The alias table is frozen and was not extended after seeing the labels, so acronym-only parser output may not match. That is reported, not corrected. | 10089434: expanded `mvc` -> `asp.net mvc`, `epo` -> `epolicy orchestrator`, `tmg` -> `forefront threat management gateway` |
| R7 | A product named only inside a certificate or course title does not count, because certificates are excluded and a course title is not evidence of use. | 11957080: removed `novell open enterprise server` (`linux` kept, since it also appears in the skills list) |

## Per-row PDF check rulings (applied)

- **10089434:** Expanded `mvc` → `asp.net mvc` ("MVC 4 for Visual Studio using .Net Framework"), `epo` → `epolicy orchestrator`, and `tmg` → `forefront threat management gateway` under rule 4 / R6. Kept `batch` (listed under scripting languages alongside PowerShell and VBScript) and `bbars` ("BBars computer backup software").
- **10247517:** Kept `ios` — appears at the end of `Operating Systems:` immediately after `OSX 10.2-10.11` and before `Hardware and WLAN:`, confirming Apple iOS.
- **10265057:** Removed `macos` — derived only from "Office for Mac" and a bare "Mac" keyword in the auto-extracted skills list, with no mention of macOS as an operating system.
- **10748989:** Removed `cadence` — appears as a client/company bullet ("Cadence.") alongside Raytheon E-Systems and Motorola in Work History, not as EDA software.
- **11580408:** Removed `c` (an auto-extracted single-letter token split from `C/side`, not C programming) and `lotus` (a bare word in the skills list with no product identified in the résumé).
- **12334140:** Kept `lotus` as written ("Lotus 2.1") per rule 4.

**Final gold skill count: 279** (295 in initial draft; 283 after R1–R7; 279 after per-row PDF checks).