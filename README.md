# DBD — Drill Baby Drill

**Current product:** DBD Base 2.0  
**Release build:** `base-2.0-final`  
**Human-facing Vault format:** `DBD Base Vault v1`  
**Browser storage key:** `dbd_gazali`

DBD is a local-first learning execution and evidence system. It does not try to replace the subject chat, the teacher, notes, or a curriculum planner.

> **Subject Chat understands. DBD executes and records.**
>
> **Score is evidence, not diagnosis.**
>
> **A UI default is not learner evidence.**

DBD Base 2.0 is the first release with two first-class execution surfaces:

1. **Question Drill** — disposable assessment packets for procedure, reasoning, application, misconception testing, visual interpretation, calculation and transfer.
2. **Flashcard Recall** — rapid front/back retrieval decks for atomic knowledge, with interruption-proof progress and exact miss history.

Both modes share the same local evidence layer, Subjects, History, Vault, import/export and resume philosophy.

---

## 1. Why 2.0 exists

DBD Base 1.x was still fundamentally a quiz app. Even after safe SVG, tables, calculator evidence, comments, confidence and History, the basic execution unit was still:

```text
question → response → grade → evidence
```

2.0 adds a second execution unit without turning DBD into an Anki clone or tutor:

```text
flashcard front → reveal → KNEW / MISSED → retrieval evidence
```

That is the architectural boundary that justifies the major version. DBD remains an execution/evidence institution; it simply is no longer limited to ordinary questions.

---

## 2. Product genealogy

### Era 0 — ASAT quiz-app ancestors

The earliest ancestor was a small offline quiz frontend used for school-exam practice (`asat_quiz_frontend_offline`, v2, v3). The first useful question was basic: can ChatGPT-generated practice become a reliable local app rather than a long chat transcript?

The answer was yes, and DBD grew from that execution idea.

### Era 1 — DBD Plus / experimental 0.x line

The historical 0.x builds were originally just called DBD. This README refers to them retrospectively as **DBD Plus** so they are distinguishable from later Base.

Important stages included approximately:

- `v0.3` / `v0.4` — early local quiz runtime experiments;
- `v0.8` / `v0.85` — stronger drill/session workflow;
- `v0.9.1`–`v0.9.5` — increasingly durable session/history behavior;
- `v0.9.6` / `v0.9.7` — versioned persistent data, Streams, Question Bank concepts and mergeable Vault ideas;
- `v0.9.8`–`v0.9.8.4.1` — canonical Subjects, Concept Manifests, Bank/Stream architecture and increasingly complex scheduling policy;
- `v0.9.9` / Dev2 — Intelligence Architecture experiments: scheduler weights/thresholds, quality feedback, alerts, Auto Session composition, richer Bank lifecycle and provenance.

DBD Plus never became a stable 1.0. The central lesson was that scheduling sophistication cannot rescue weak questions, duplicated UI, opaque state, or excessive runtime complexity.

### Era 2 — DBD Lite

DBD Lite deliberately removed the scheduler-heavy architecture. It asked what the irreducible useful core actually was.

That pivot established the principle that semantic intelligence belongs upstream in the subject chat, while the app should be excellent at execution and empirical evidence.

### Era 3 — DBD Base 1.0

DBD Base 1.0 formalized the institution:

```text
Subject Chat → JSON packet → DBD Base → attempt evidence → Subject Chat
```

The Base 1.0 revisions accumulated practical features:

- canonical Subject records and aliases;
- local History and Vault compatibility;
- safe inline SVG;
- table stimuli;
- calculator and later calculator expression history;
- dark/light appearance;
- compressed lossless transport (`DBD Compact v1`);
- delete/export controls;
- better typed-answer and mobile controls;
- stronger prompt doctrine and packet validation.

`r5` is treated as the frozen final 1.0 revision.

### Era 4 — Base 1.5 cleanup doctrine

The 1.5 design work identified that many Base problems were not missing features but accumulated construction scaffolding: duplicated overrides, old Stream/Bank assumptions leaking into Base UI, browser-default surfaces, oversized controls, confusing schema jargon, and one-way question navigation.

The 2.0 final build carries forward those cleanup requirements: compact scale, cleaner History, separated evidence types, safer comments, richer navigation and a human-facing Vault format name.

### Era 5 — DBD Base 2.0

2.0 adds **Flashcard Recall** beside Question Drill while keeping the same institutional boundary.

It does **not** add autonomous curriculum planning, a permanent card scheduler, spaced repetition, AI tutoring inside the app, XP, streaks, or a new knowledge-management layer.

---

## 3. Home architecture

Home exposes two explicit lanes.

### Question Drill

- **COPY QUIZ PROMPT**
- **IMPORT QUIZ PACKAGE**

### Flashcard Recall

- **COPY RECALL PROMPT**
- **IMPORT FLASHCARD DECK**

The two importers share low-level parsing infrastructure but intentionally have different product entry points, validation language and generation prompts.

Home metrics are:

- **Completed**
- **Questions answered**
- **Subjects**

`Questions answered` counts ordinary question-session items, not flashcards. Recall performance is visible in Recall History/results.

---

## 4. Question Drill

Question Drill is the correct surface for:

- procedures;
- calculations;
- application;
- misconception testing;
- data/graph/map interpretation;
- integrated reasoning;
- transfer;
- exam-style mixed testing.

### Supported question types

- `mcq`
- `multi_select`
- `numeric`
- `short`
- `essay`

For `multi_select`, use an answer array:

```json
{
  "type": "multi_select",
  "prompt": "Select every true statement.",
  "choices": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "..."
  },
  "answer": ["A", "C"]
}
```

2.0 uses exact-set grading by default. There is no automatic partial-credit system.

### Previous / Next

Question navigation is reversible.

- Before grading/reveal, a response remains editable.
- With after-session feedback, moving away saves the current response and it can still be edited until final session submission.
- With immediate feedback, once the answer key has been revealed the graded response becomes immutable, but Previous can still reopen it for inspection.

**Navigation is reversible. Grading is not.**

### Confidence

New responses do not default to `Sure`.

Confidence is evidence only when the learner explicitly selects it. A packet can disable the confidence rail with:

```json
"confidence": "off"
```

### Context label

A question may carry a small non-spoiling scope/domain cue:

```json
"context_label": "Technical Geography"
```

Use this only when it helps establish legitimate scope without revealing the answer strategy.

---

## 5. Representation system

Question Drill and Flashcard Recall share the same structured-rendering system.

### Plain text

Use when text/equations are already the clearest representation.

### Native table

Use for aligned givens, comparable data, datasets and reaction sets.

```json
{
  "type": "table",
  "title": "Data reaksi",
  "columns": ["Reaksi", "ΔH"],
  "rows": [
    ["C(s) + O₂(g) → CO₂(g)", "−400 kJ"],
    ["2H₂(g) + O₂(g) → 2H₂O(l)", "−600 kJ"]
  ]
}
```

The 2.0 final CSS explicitly prevents structured tables from inheriting old `white-space: pre-wrap` behavior that caused large blank gaps and clipping.

### Sanitized SVG

Use when spatial/structural information is part of the learning target:

- geometry;
- graphs;
- vectors / free-body diagrams;
- chemical structures;
- maps / schematics;
- symbolic visual identification.

Use semantic classes instead of hard-coded theme colors:

- `svg-main-line`
- `svg-accent-line`
- `svg-muted-line`
- `svg-secondary-line`
- `svg-danger-line`
- `svg-success-line`
- `svg-label`
- `svg-accent-label`
- `svg-secondary-label`
- `svg-danger-label`
- `svg-success-label`
- fill variants matching those roles

Remote resources, scripts, event handlers, `foreignObject` and external links are rejected.

---

## 6. Flashcard Recall

Recall is designed for rapid breadth retrieval, especially in low-context situations where a full written problem is not appropriate.

Use it for:

- terminology;
- definitions;
- classifications;
- named theories;
- reverse recognition;
- short causal chains;
- formulas/rules;
- symbol meanings;
- compact visual identification.

Do not use it as a substitute for integrated problem solving.

### Packet

```json
{
  "packet_type": "flashcards",
  "dbd_version": "DBD Base 2.0",
  "title": "Climate fundamentals",
  "subject": "Geography",
  "topic": "Climate and Climate Change",
  "source": "Asthina METKLIM",
  "cards": []
}
```

### Card

```json
{
  "id": "geo-climate-001",
  "topic": "Climate and Climate Change",
  "subtopic": "Atmospheric circulation",
  "type": "TERM",
  "front": "mT",
  "back": "Maritime tropical: warm and moist",
  "front_stimulus": null,
  "back_stimulus": null,
  "priority": "core",
  "source": "Asthina METKLIM",
  "tags": ["geography", "selection2"]
}
```

`type` is metadata only. Useful conventions include:

- `TERM`
- `REVERSE`
- `CONTRAST`
- `MECHANISM`
- `FORMULA_RULE`
- `VISUAL`

### Rich flashcards

Flashcards can place native table or safe SVG stimuli on **either side**.

Example visual front:

```json
{
  "type": "VISUAL",
  "front": "Which angle is highlighted?",
  "front_stimulus": {
    "type": "svg",
    "title": "Circle geometry",
    "svg": "<svg viewBox='0 0 420 260'>...</svg>"
  },
  "back": "Central angle"
}
```

This is the same sanitized renderer used by Question Drill; there is no second graphics subsystem.

### Recall runtime

Default loop:

```text
Round 1: All cards
       ↓
KNEW / MISSED
       ↓
Review Missed
       ↓
Review Missed ...
```

After each round:

- Known count
- Missed count
- Review Missed
- Review All Again
- Finish Session

No spaced-repetition scheduler is included.

### Resume

Recall sessions save local state continuously:

- current round;
- queue;
- current card;
- rated cards;
- known/missed state;
- response time history;
- elapsed session evidence.

Closing the browser halfway through a deck should not require reconstructing progress.

### Rating

The MVP rating is intentionally binary:

- **KNEW**
- **MISSED**

No default `Sure / Unsure / Guess` rail is used in Recall Mode.

---

## 7. Calculator

The inline calculator remains available in Question Drill.

2.0 final adds:

- cursor-position editing;
- left/right movement;
- insertion at cursor;
- expression/result history;
- **USE ANSWER** for typed/numeric response fields.

The calculator remains a training tool, not a claim that a real exam permits one.

---

## 8. Comments and product feedback

Question comments are split into two evidence channels.

### Content comment

Example:

> "Gue sebenarnya ngerti mekanismenya tapi lupa istilah."

This belongs in academic Results sent back to the Subject Chat.

### DBD product feedback

Example:

> "Table clips on my phone."

This is preserved separately in session JSON and is intentionally omitted from normal academic Results text.

The goal is to stop product/UI complaints from contaminating subject diagnosis.

---

## 9. Evidence doctrine

DBD records observations, not causal diagnoses.

Question evidence may include:

- final answer;
- objective correctness;
- explicit confidence;
- active time;
- full answer choices;
- calculator trail;
- self-reported error cause;
- tags / prerequisite context;
- content comment;
- product feedback separately;
- flags.

Recall evidence may include:

- exact card;
- KNEW/MISSED;
- round;
- response time;
- first-pass misses;
- final unresolved cards;
- repeated retrieval history.

A `2/5` does not mean "40% conceptual mastery." It means two objectively correct final responses according to that packet's answer contract.

---

## 10. History and legacy data

Normal History contains real, openable Base sessions:

- Question Drill sessions;
- Flashcard Recall sessions.

Old DBD Plus Stream events are not shown as if they were equivalent Base sessions. They remain preserved under the Vault/Legacy Archive compatibility layer.

The same principle applies to old Question Bank inventory: preserve the data, retire the machinery.

---

## 11. Vault and schema terminology

The user-facing persistent format is:

**DBD Base Vault v1**

Old exported/browser data may still contain the historic numeric `schemaVersion: 7` field because the compatibility importer/normalizer descends from DBD Plus. That number is migration baggage, not the product identity.

DBD Base 2.0 also stores:

```text
baseVaultVersion = 1
```

The ordinary JSON Vault remains canonical. `DBD Compact v1` remains an optional, lossless GZIP + Base64URL transport wrapper with SHA-256 integrity checking.

---

## 12. Deliberate non-features

DBD Base 2.0 does **not** include:

- autonomous curriculum planning;
- semantic diagnosis;
- automatic mastery claims;
- adaptive scheduling;
- spaced repetition / FSRS;
- flashcard due dates;
- giant deck-management UI;
- AI explanations inside DBD;
- XP / streaks / gamification;
- persistent interactive textbook materials;
- direct OpenAI API calls.

Subject Chat remains the semantic authority.

---

## 13. Repository files

The GitHub Pages release is intentionally flat:

- `index.html`
- `app.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `favicon-32.png`
- `favicon.svg`
- `icon-192.png`
- `icon-512.png`
- `README.md`
- `DBD_BASE_PROMPT_PROTOCOL.md`
- `DBD_BASE_PACKET_v2.example.json`
- `DBD_BASE_FLASHCARDS_v2.example.json`

Upload them together to `/dbdbase/`.

A standalone HTML build may also be provided for local convenience, but it is **not** the canonical GitHub source package.
