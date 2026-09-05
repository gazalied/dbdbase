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
