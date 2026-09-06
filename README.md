# DBD Base v1.0 — r4

Build: `base-1.0-r4`  
Schema: **Schema 7 Base** (numeric compatibility remains `7`)

## r4 — canonical Light-mode pass

r4 replaces screenshot-by-screenshot recoloring with one canonical Light-theme audit layer.

### Visual model

Dark mode remains the machine/interface mode. Light mode is **DBD printed on warm technical paper**:

- warm paper background;
- slightly lighter primary cards;
- slightly darker inset surfaces;
- charcoal ink instead of hard black;
- warm gray metadata;
- deep amber for ordinary DBD actions and the logo;
- brighter yellow reserved for the hazard ribbon;
- red/green/blue only when semantically meaningful.

### Shell / brand

- DBD logo uses deeper amber in Light mode.
- BASE becomes quieter gray microtype.
- Hazard ribbon remains yellow/black but its old shadow is removed.
- Header is crisp/flat instead of visually floating.

### Codebase audit

The r4 override explicitly covers legacy dark-era surfaces across Home, Ongoing/Pending sessions, Subjects, Subject empty/recent states, History, Review, Navigator, Summary/Results, Full Quiz review, Settings/Data, Preflight, Pause and Navigator overlays, type cards, daily cards, and legacy quiz cards.

This removes the remaining “black island on beige page” effect while preserving Dark mode, Schema 7 Base, Subject aliases, the r3 calculator, semantic SVG renderer, and the r3.1 Skip hotfix.


---

# DBD Base v1.0 — r3.2

Build: `base-1.0-r3.2`  
Schema: **Schema 7 Base** (numeric compatibility remains `7`)

## r3.2

Light mode was reworked after phone testing.

- Replaced stark white surfaces with a warmer, lower-glare paper palette.
- Added clearer hierarchy between page, card, inset, SVG canvas, and controls.
- Restored stronger semantic result accents: wrong states are visibly red, correct states visibly green.
- Kept yellow reserved for DBD action/selection; Comment remains blue; active Flag remains red.
- Centered the Dark / Light appearance control in Settings.
- Settings now reads as one coherent warm page instead of stacked white blocks.
- Pause, Navigator, Preflight, Subject Editor, Vault, and dormant-data surfaces now follow the same warm light palette.
- Dark mode and the r3.1 Skip hotfix are preserved.


---

# DBD Base v1.0 r3.1 — hotfix

Build: `base-1.0-r3.1`

This hotfix keeps the r3 design and Schema 7 Base intact.

## Fixed

- Split Submit/Skip now shares one aligned hitbox. The old `.typed-submit` margin/width styles no longer distort the left side of the split button.
- Skip now truly skips. A skipped question is not immediately recycled by the first-pass navigator. When no fresh questions remain, Base goes to Review, where skipped items are visible and can be revisited deliberately.
- The explicit divider between confidence and tools gets slightly more spacing to avoid a doubled-border look on narrow phones.

No Vault migration is required.

---

# DBD Base v1.0 — r3

Build: `base-1.0-r3`  
Schema label: **Schema 7 Base**  
Numeric compatibility: **7**

## r3 field-tested changes

- Calculator is now a permanent Base quiz tool:
  - always available as `🧮`;
  - expands **inline below the quiz controls**, never in a modal;
  - includes both `(` and `)`;
  - shows a live grey result preview below the expression;
  - records calculator use/open count.
- Typed/essay submission is split approximately **80% Submit / 20% Skip**.
- Typed answered state remains `answer | NEXT →`.
- Confidence is one segmented switch: **Sure / Not sure / Ngasal**.
- A divider separates confidence from the three tool icons.
- Comment is a blue-gradient state and expands to only a textarea.
- Flag is independent and turns red when active.
- Wrong-answer classification now sits **immediately below the explanation and above the control rail**.
- Only three causes are visible initially: Forgot rule, Wrong method, Careless; the rest live under `•••`.
- Dark remains the default; Light is available in Settings and persists locally.
- SVG renderer hardening:
  - semantic SVG classes;
  - theme-aware palette;
  - known legacy DBD colors remapped to theme variables;
  - missing text fills repaired;
  - small label halo for readability;
  - degree labels receive a conservative upward nudge to reduce line collisions;
  - tighter mobile SVG height so diagrams remain stimuli rather than dominating the quiz.
- The Base generation prompt now explicitly requires good SVG label clearance and semantic styling.
- Subject Editor / alias merging from r2 is preserved.

## Core contract

`subject ChatGPT → JSON packet → DBD Base renderer → attempt evidence → history`

DBD Base remains a renderer/evidence recorder, not a semantic tutor or long-term scheduler.

---
# DBD Base v1.0 — r2 polish

Build ID: `base-1.0-r2`.

## Changes
- Header has Subjects, History and Settings only; the DBD wordmark is Home.
- BASE is a small monospace superscript, not a badge shape.
- Home removes explanatory copy and renderer-capability copy.
- Long pending-packet titles/filenames wrap safely on phones.
- Subject Editor can merge subjects, rename canonical subjects and add aliases.
- Merges preserve old completed-drill labels while grouping them through aliases.
- Schema 7 Base Settings shows canonical subjects and aliases.
- New PWA icons, maskable metadata, Apple touch icon, and favicon.

---

# DBD Base v1.0

**Product:** DBD Base  
**Version:** 1.0  
**Visible schema:** Schema 7 Base  
**Numeric compatibility:** Schema 7  
**Local storage key:** `dbd_gazali`

DBD Base is the finished baseline execution layer of Drill Baby Drill.

It does **not** mean the future intelligent/full DBD has reached v1.0.

The product contract is:

```text
trusted JSON packet
→ high-quality renderer
→ answer
→ feedback
→ factual evidence
→ history
```

## Why “Base”

The former Lite branch proved that the durable value is not “a smaller DBD.” It is the base layer that future DBD intelligence can sit on top of.

DBD Base owns execution and rendering. It does not decide what the learner should study.

## v1.0 capabilities

- JSON packet import
- preflight validation
- MCQ with selected-answer inline `NEXT →`
- short and numeric open answers
- number-oriented mobile keyboard for numeric questions
- flexible accepted-answer matching
- optional regex answer patterns
- essay/self-check surfaces
- sanitized inline SVG
- SVG marker arrowheads / technical diagrams
- built-in calculator when the packet allows it
- calculator-use evidence
- Sure / Not sure / Ngasal confidence
- Skip and Comment
- compact error-cause reflection
- completed drill History
- one factual `COPY RESULTS` handoff
- automatic Markdown result download when too long
- local Vault export/merge
- backward-compatible preservation of old experimental Question Bank / Stream data

## v1.0 UI rules learned from field use

- The MCQ answer itself becomes the continuation surface.
- For open answers, `NEXT →` sits beside the submitted answer in the same box.
- Explanation follows below.
- Confidence / Skip / Comment appear as one pill family below feedback.
- There is no duplicate one-line note.
- There is no dedicated `I DON'T KNOW` button.
- “What happened?” shows three immediate causes and hides the rest under `•••`.
- SVGs are display-only and cannot intercept answer-button hitboxes.
- The preflight card is hardened against long filenames/topics and narrow mobile screens.
- One readable Inter-based type system is used throughout; the DBD wordmark keeps its older system-heavy look.

## Schema 7 Base

The internal numeric schema remains `7` so existing Vaults remain compatible.

Older Question Bank / scheduler-era fields may remain stored, but DBD Base does not use them to choose daily questions.

History is preserved without forcing old experimental architecture back into the product.

## Open-source note

The project is structurally ready to publish as source code. No software license is bundled in this package; choosing a license (for example MIT, Apache-2.0, GPL, etc.) is a separate legal/product decision.
