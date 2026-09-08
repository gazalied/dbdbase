# DBD — Drill Baby Drill

**Current product:** DBD Base 1.5  
**Build:** `base-1.5`  
**Local storage key:** `dbd_gazali`  
**Persistent format:** DBD Base Vault v1  
**Packet format:** DBD Base Packet v1  
**Optional packet transport:** DBD Compact v1

DBD is a local-first, mobile-first learning execution system for AI-generated practice.

The current constitutional rule is:

> **Subject Chat understands. DBD Base executes and records.**

A second rule emerged from real school use:

> **Score is evidence, not diagnosis.**

DBD Base may record a raw score, a wrong answer, a calculator trail, a skip, confidence, timing, comments, and tags. It does not turn those observations into an autonomous claim about mastery. The Subject Chat remains responsible for curriculum judgment, diagnosis, explanation, and deciding what should happen next.

---

# 1. What DBD Base 1.5 is

DBD Base 1.5 is the final streamlined Version-1 architecture.

Version 1.0 r5 proved the durable product. Version 1.5 rebuilds that discovered product as if the architecture had been known from the beginning.

The main runtime is intentionally small:

```text
1. SHELL
   navigation / theme / routes

2. DATA
   Vault / Subjects / Sessions

3. PACKET
   parse / normalize / validate

4. RENDER
   question renderer / stimulus renderer

5. SESSION
   run / navigate / pause / review

6. EVIDENCE
   answer / confidence / calculator / comments / history

7. TRANSPORT
   JSON / optional DBD Compact packet import
```

DBD Base 1.5 does **not** contain the old smart scheduler, Stream engine, Question Bank scheduler, autonomous mastery model, or concept-urgency machinery. Old records from those experiments can still be preserved in the Legacy Archive.

The rule is:

> **Preserve the data. Retire the machinery.**

---

# 2. Current learning architecture

The intended learning flow is:

```text
TEACHER / MATERIAL
        ↓
Google Drive
raw source storage
        ↓
SUBJECT CHATGPT
semantic understanding
teaching
scope judgment
diagnosis
question construction
        ↓
DBD BASE PACKET
        ↓
DBD BASE
render → drill → evidence → history
        ↓
RESULTS
        ↓
SUBJECT CHATGPT
interpret → repair → next packet
```

Canonical shorthand:

> **Drive stores. Docs map. ChatGPT understands. DBD drills/measures.**

DBD Base is intentionally not a textbook, syllabus manager, or autonomous tutor.

---

# 3. DBD Base 1.5 capabilities

## Question surfaces

DBD Base 1.5 supports:

- MCQ — exactly one correct answer;
- Multi-select / Rich MCQ — more than one correct option;
- Numeric;
- Short answer;
- Essay / self-check.

### Multi-select

A multi-select question uses:

```json
{
  "type": "multi_select",
  "choices": {
    "A": "Statement one",
    "B": "Statement two",
    "C": "Statement three",
    "D": "Statement four"
  },
  "answer": ["A", "C"]
}
```

Version 1.5 uses exact-set grading. Partial-credit logic is deliberately out of scope.

## Structured stimuli

DBD Base has three native stimulus families:

```text
TEXT
TABLE
SANITIZED SVG
```

Use plain text when prose/symbols are clearest.

Use tables when alignment/comparison is the information: Hess-law equation sets, calorimetry givens, data tables, value tables, and similar structures.

Use SVG only when spatial structure matters: geometry, graphs, vectors, free-body diagrams, skeletal chemical structures, isomers, energy profiles, and similar material.

The renderer keeps text/table/SVG separate so text-only whitespace rules cannot leak into structured tables.

## Answer matching

Numeric matching normalizes a superficial leading `+`:

```text
12.5
+12.5
```

are normally treated as the same positive number.

Packets may also use:

- `accepted_answers`;
- `answer_regex`;
- `tolerance` for legitimate numeric approximation.

## Calculator

The Base calculator remains deliberately small rather than becoming a full scientific calculator.

Version 1.5 adds:

- editable expression text;
- insertion at the cursor;
- left/right cursor movement;
- live result preview;
- `USE ANSWER`, which places the current result into a typed-answer field;
- expression/result history retained as evidence.

Example evidence:

```text
Calculator history:
1. 250*4.18*5 = 5225
2. 5225/1000 = 5.225
```

The Subject Chat can inspect this trail to understand whether a failure arose around setup, arithmetic, conversion, sign interpretation, or something else. Base itself does not decide which interpretation is correct.

## Evidence recorded

A completed attempt may preserve:

- full prompt;
- complete MCQ choices;
- learner answer;
- reference answer;
- objective correctness where applicable;
- confidence: Sure / Not sure / Ngasal;
- learner-recorded error cause;
- optional skip reason;
- response time;
- calculator trail;
- comment;
- flag;
- human-facing tags;
- optional prerequisite context;
- explanation/reference material.

This allows the Subject Chat to distinguish cases that a raw score alone would collapse together.

---

# 4. Session model

A Base session is a deliberate imported packet.

```text
COPY PROMPT
    ↓
Subject Chat builds packet
    ↓
IMPORT PACKAGE
    ↓
PREFLIGHT
    ↓
ACTIVE DRILL
    ↓
FINAL REVIEW
    ↓
HISTORY / RESULTS
```

## Minimal Launch Settings

Packet metadata is authored upstream by the Subject Chat. Preflight only exposes controls the learner may reasonably change at launch time:

- Feedback: immediate / after session;
- Show timer;
- Additional focus for the next generation request.

Base does not ask the learner to reconfigure answer format, working style, difficulty, test type, or question count after ChatGPT already designed the packet.

## Skip behavior

Skipped questions do not immediately recycle into the first-pass queue.

```text
Skip Q1 → next untouched question
...
no untouched questions remain → Final Review
```

Skipped questions remain available from Final Review.

An optional skip-reason prompt can record distinctions such as:

- did not know;
- time;
- deliberate skip;
- question issue.

Ignoring the reason prompt is allowed.

## Timing

DBD records active session/question time. A visible timer is optional.

Version 1.5 keeps per-session timing reliable but does not yet introduce a multi-session Campaign telemetry architecture. That belongs to the future Version-2 layer.

---

# 5. Results philosophy

Raw accuracy remains visible because it is factual evidence.

It is not presented as a mastery diagnosis.

A learner can score 40% while executing most of a procedure correctly and repeatedly failing only at a final sign flip, unit conversion, or operator. The exported evidence must remain rich enough for the Subject Chat to recognize that distinction.

The Results handoff therefore includes full answer choices and process evidence where available.

When copied Results become too large for comfortable clipboard use, Base downloads Markdown instead of silently truncating the evidence.

---

# 6. Subjects

Subjects are canonical records used to group sessions without rewriting historical provenance.

A subject record contains:

- canonical name;
- aliases.

Example:

```text
Canonical:
Matematika Wajib

Aliases:
Math Wajib
Matwa
MW
```

Aliases allow historical labels to remain intact while grouping records under one canonical subject.

The Subjects view can:

- inspect sessions;
- download Subject History;
- rename a subject;
- add aliases;
- merge duplicate subject records;
- delete a subject and its normal Base sessions.

Legacy Archive data is not silently destroyed by ordinary Subject deletion.

---

# 7. History and Legacy Archive

Normal **History** is reserved for inspectable completed sessions.

Old scheduler-era Stream telemetry is not shown as though it were a normal Base session, because it cannot be reopened with the same complete question/evidence object.

Legacy material is preserved separately:

```text
SETTINGS
└── LEGACY ARCHIVE
    ├── old Question Bank records
    ├── Stream attempts
    ├── old manifests
    └── legacy scheduler metadata where preserved
```

Legacy records are excluded from normal completed-session and historical-answer counts.

This implements the rule:

> **History should represent work the learner can actually inspect.**

---

# 8. Data formats

Version 1.5 stops exposing a naked historical `Schema 7` number in the normal UI.

Every version number now has a noun.

## DBD Base Vault v1

The persistent local database stored under:

```text
dbd_gazali
```

Current canonical shape includes:

```json
{
  "format": "dbd-base-vault",
  "vaultFormatVersion": 1,
  "subjects": [],
  "completedSessions": [],
  "activeSessions": [],
  "pendingPacket": null,
  "legacyArchive": {},
  "settings": {}
}
```

On first boot, old unversioned and Schema 2–7 DBD data are normalized through a compatibility boundary and then persisted as DBD Base Vault v1.

Migration provenance may be retained, including the old schema number.

## DBD Base Packet v1

The current execution packet format.

Typical packet:

```json
{
  "dbd_version": "DBD Base 1.5",
  "campaign": "...",
  "subject": "Kimia",
  "topic": "Termokimia",
  "source": "...",
  "test_type": "repair",
  "difficulty": "Adaptive",
  "feedback": "immediate",
  "timing": "record",
  "show_timer": false,
  "questions": []
}
```

Base normalizes older compatible packet field names at import.

## DBD Compact v1

DBD Compact remains an optional **packet transport**, not the normal Vault workflow.

Exact form:

```text
DBDC1.GZ.<sha256-hex>.<base64url-gzip-payload>
```

It represents complete minified UTF-8 JSON compressed losslessly with GZIP, then Base64URL encoded. The SHA-256 checksum protects against corrupted copy/paste.

Use case:

```text
large quiz packet
future flashcard packet
clipboard / messaging transport
```

Ordinary Vault backup remains a normal JSON file because lifetime Vaults remain too large for practical chat-message transport even after compression.

---

# 9. Settings

Settings is now an action-oriented page rather than a developer status dashboard.

Normal settings expose:

- Dark / Light appearance;
- local-data size and counts;
- Export Vault;
- Merge Vault;
- Legacy Archive;
- external project links;
- collapsed Technical details;
- collapsed Danger zone.

Project links:

- Website: https://gazalied.github.io/
- GitHub: https://github.com/gazalied/dbdbase

Renderer-capability documentation belongs in this README rather than occupying the normal Settings screen.

---

# 10. Visual system

DBD has one semantic UI system.

Dark mode is the default and retains the machine/interface character.

Light mode uses the warm technical-paper model discovered during the 1.0 field tests.

Shared semantic variables represent:

```text
page
surface
inset surface
border
primary text
secondary text
DBD accent
correct
wrong
comment / blue
```

Components do not carry revision-specific recolor patches.

The yellow/black hazard ribbon remains brand identity, but it is crisp and flat rather than shadowed.

The app header keeps `DBD` with a small `BASE` superscript.

The installed app icon and favicon use only:

```text
black field
large vertically prominent yellow DBD
```

No `BASE` and no underline are used in the icon.

---

# 11. Product genealogy

The name **DBD Plus** is used retrospectively in this document for the pre-Base smart/scheduler branch. Those builds were originally titled simply `DBD`.

DBD Plus never reached a final 1.0 release. Its experiments ultimately produced the simpler Base architecture.

## Era A — ASAT Quiz Frontend

### ASAT Quiz Frontend / offline

The ancestor was a small exam-practice frontend built around pasted NotebookLM/AI JSON.

Core loop:

```text
paste generated quiz
→ answer
→ immediate correctness
→ next
→ review wrong
```

The central question was simple:

> Can generated practice become a usable interactive quiz instead of remaining chat text?

### ASAT Quiz Frontend v2

Continued the same lightweight JSON-driven exam-practice frontend and refined the interaction while remaining focused on the immediate quiz rather than a persistent learning system.

### ASAT Quiz Frontend v3

The surviving v3 artifact explicitly asks the generator for A–E choices and explanations for every option. It strengthened generation/feedback quality but still remained an ASAT-oriented quiz frontend.

---

## Era B — early DBD

### DBD v0.3

The product was renamed **Drill Baby Drill**.

The surviving build contains the early DBD language:

- choose a target;
- build a chatbot prompt from mistakes;
- paste generated quiz material;
- brutal A–E drill;
- reveal/self-check;
- record correct/wrong.

This is the point where the app began to be framed as a repeated retrieval/drill system rather than one exam frontend.

### DBD v0.4

v0.4 expanded the early app into a broader local learning workspace:

- targets;
- saved materials / Library;
- progress;
- review queue;
- adaptive-review prompt building;
- recent completed drills;
- backup/restore.

This generation already contained the idea that old attempts should influence what the chatbot generates next.

---

## Era C — structured Session runner

### DBD v0.8

DBD became recognizably packet/session based.

The surviving build includes:

- JSON packet import;
- drill setup/customization;
- pause/resume;
- report generation;
- retry wrong;
- retry wrong + slow;
- persistent local data;
- backup import/export.

### DBD v0.8.5

Added a more explicit **preflight** workflow and editable customization without throwing away the imported packet.

The build also exposed Summary / Full Quiz evidence views and stronger deployment/backup discipline.

---

## Era D — DBD Plus evidence/UI refinement

### DBD v0.9.1

A major deliberate-drill UX expansion:

- six test types;
- Sure / Not sure / Ngasal confidence;
- previous-question navigation and mobile navigator;
- I Don't Know, Skip, Flag;
- confidence-aware reports;
- paperless conceptual mode;
- Daily Quick Scan → Main Drill → Close the Loop;
- multiple ongoing sessions;
- question-count presets;
- MCQ/mixed formats;
- AI-set timing;
- packet preflight and full history.

### DBD v0.9.2

Continued the Session architecture and consolidated the Main Drill flow around packet import, preflight, question navigation, Review Session, and a cleaner report handoff. A surviving 30-question example packet belongs to this generation.

### DBD v0.9.3

Shifted the main navigation and visual hierarchy toward the DBD identity:

- DBD logo became Home;
- hazard stripe became a persistent brand element;
- ongoing sessions moved forward;
- Import Packet / copied instructions became primary actions;
- per-question comments;
- larger question cards;
- pause-focused active toolbar;
- giant score summary;
- split `Copy Diagnostics` / `Copy Pure Results` evidence exports.

### DBD v0.9.4

Expanded persistent-data management and History presentation while keeping the application browser-local. It made the local database and completed-session history more explicit in the UI.

### DBD v0.9.5

Further refined the question/session/history runtime before the architecture started adding persistent knowledge entities. This was effectively the last major pre-schema Session-only generation.

---

## Era E — DBD Plus Version-1 Foundation

### DBD v0.9.6 — explicit data Schema 2

The README calls this **Version 1 Foundation**.

It introduced:

- stable packet/question/session IDs;
- mergeable DBD Vault handoff;
- stable device identity;
- dynamic Stream subject registry;
- concept evidence rebuilt from tagged attempts;
- future Question Bank structure.

The smart scheduler was still reserved for later.

Historically, explicit schema numbering begins here at Schema 2; there is no important surviving DBD Schema 1 that Base needs to preserve as a product identity.

### DBD v0.9.7

First visible preview of the smart v1 product architecture:

- **STREAM** first on Home;
- historical eligible MCQs reused as quick retrieval cards;
- **SESSION** retained for deliberate packet work;
- dynamic Subjects page;
- Vault/stable IDs preserved;
- real scheduler and dedicated Bank inventory still not fully enabled.

---

## Era F — DBD Plus smart architecture

### DBD v0.9.8 — Schema 3

Described as the definitive v1 beta.

Major architecture:

- canonical Subject normalization;
- Concept Manifests;
- hierarchy/graph views;
- concept evidence states;
- concept-first scheduler;
- reusable Question Bank imports;
- finite five-question Stream Bursts;
- subject Stream activation/priority;
- inventory/refill prompts;
- richer Vault merge;
- data-health diagnostics;
- installable/offline GitHub Pages package.

Legacy sessions were preserved rather than rewritten.

### DBD v0.9.8.1

Continued hardening the v0.9.8 knowledge/Bank/Stream beta while preserving the same local-first architecture and compatibility model.

### DBD v0.9.8.2

Further iteration on the same v1-beta stack: knowledge structure, reusable Bank inventory, Stream retrieval, Subjects and Vault portability.

### DBD v0.9.8.3 — Schema 4 / Stream Policy

Separated **history** from **current drill policy**.

Added:

- Stream Diet / subject weights;
- Solo;
- Mute / Activate;
- per-subject difficulty focus;
- Legacy allowed vs Bank-only policy;
- concept-first scheduler obeying the subject diet;
- policy timestamps and Vault merge support.

Its defining rule was:

```text
History says what happened.
Knowledge says what exists.
Stream Policy says what DBD is allowed to drill now.
```

### DBD v0.9.8.4 — Schema 5

Hardened the Stream/Bank architecture and packaging while maintaining the same five-layer model:

```text
History
Knowledge structure
Question Bank
Stream Policy
Scheduler
```

### DBD v0.9.8.4.1 — Schema 5 rewrite

A code/package rewrite of the hardened v0.9.8.4 architecture. This became the stable source from which later 0.9.9 experiments were developed.

---

## Era G — DBD Plus intelligence experiment

### DBD v0.9.9 — Schema 6

The **Intelligence Architecture** experiment.

The scheduler became more formal and evidence-weighted. Persistent policy/configuration included concepts such as:

- scheduler weights and thresholds;
- quality feedback;
- alert state;
- engine metadata;
- Auto Session concepts;
- richer Stream evidence/provenance.

The goal was to derive useful scheduling decisions from raw evidence without pretending a stored mastery score was ground truth.

This experiment taught an important lesson: scheduler sophistication was growing faster than question quality and interaction quality.

### DBD v0.9.9-dev2 — Schema 7 / Fast Drill beta

Dev2 explicitly states:

> **The scheduler is not the product. The drill is the product.**

Schema 7 added:

- authoritative Subject Manifests;
- stable concept IDs/ontology revisions;
- Bank Collections with Active / Paused / Retired / Quarantined lifecycle;
- new Generation Protocol v2;
- faster action-first drill UI.

It also moved many management surfaces out of normal Home.

This was the last major smart DBD Plus schema.

The development conclusion was decisive:

```text
question quality
× scheduler intelligence
× interaction speed
```

A smarter scheduler could not compensate for weak generated questions or a bloated runtime.

---

## Era H — simplification

### DBD Lite v1

DBD was deliberately stripped back to determine the irreducible useful core.

The question became:

> What remains valuable if the autonomous scheduler, Bank-management burden, and knowledge-graph UI are removed?

The answer was the packet drill loop:

```text
Subject Chat
→ generated packet
→ Base-like renderer
→ evidence
→ Subject Chat
```

### DBD Lite v1.1

Refined the stripped execution experience and confirmed that Lite was not merely a weaker DBD. It was exposing the foundational layer that the larger system had been obscuring.

The branch was therefore renamed **DBD Base**.

---

## Era I — DBD Base 1.0

### DBD Base 1.0

Formalized the execution/evidence layer as a product in its own right.

Core contract:

```text
trusted JSON packet
→ renderer
→ answer
→ factual evidence
→ history
```

The old Schema 7 container remained temporarily for Vault compatibility, even though most Schema-7 scheduler machinery was no longer active.

### DBD Base 1.0 r2

- simpler header;
- DBD wordmark as Home;
- small BASE superscript;
- Subject Editor;
- aliases / rename / merge;
- improved mobile wrapping;
- refreshed PWA identity.

### DBD Base 1.0 r3

Field-tested quiz-control redesign:

- always-available inline calculator;
- live calculator preview;
- split Submit / Skip;
- inline `answer | NEXT →` typed-result surface;
- Sure / Not sure / Ngasal segmented control;
- calculator / comment / flag tool rail;
- compact wrong-answer cause picker;
- semantic theme-aware SVG renderer;
- Dark/Light appearance.

### DBD Base 1.0 r3.1

Hotfix:

- corrected Submit/Skip alignment;
- fixed Skip so skipped questions do not immediately recycle before first-pass completion.

### DBD Base 1.0 r3.2

First substantial Light-mode reform:

- warmer paper surfaces;
- stronger semantic red/green states;
- centered appearance selector;
- coherent light overlays/settings.

### DBD Base 1.0 r4

Canonical Light-mode pass:

- “technical paper” design language;
- deeper amber for normal Light-mode DBD identity;
- brighter yellow reserved for the hazard stripe;
- removed ribbon shadow;
- audited black/dark legacy islands across the UI.

### DBD Base 1.0 r5 — final 1.0

Evidence + portability release:

- detailed generation doctrine;
- representation selection: text / table / SVG;
- native table stimulus;
- calculator expression/result history;
- DBD Compact transport experiment;
- Subject History export;
- session/Subject deletion controls;
- minimal Launch Settings;
- broader evidence export.

Real Termokimia usage then clarified the next set of principles:

1. raw score must not be treated as diagnosis;
2. calculator trail is valuable process evidence;
3. confidence/comment/skip states should remain distinct;
4. full MCQ choices are necessary for packet auditing;
5. representation quality matters;
6. question-generation validity belongs upstream;
7. dependency failure should not be silently attributed to the target skill;
8. future flashcards should handle atomic retrieval while quiz remains for application/transfer.

---

## Era J — DBD Base 1.5

DBD Base 1.5 is the final Version-1 consolidation.

The goal is analogous to taking an experimental machine assembled over many revisions and rebuilding it with fewer, cleaner components.

Main changes:

- one canonical renderer instead of revision-specific function overrides;
- one canonical theme/component system instead of layered recolor patches;
- DBD Base Vault v1 replaces naked Schema-7 identity in the active architecture;
- old schemas handled only at the migration boundary;
- normal History contains only inspectable sessions;
- Legacy Stream / old Bank data moved to Legacy Archive;
- settings redesigned around actual actions;
- DBD Compact retained only as optional packet transport;
- multi-select / Rich MCQ;
- calculator cursor editor and `USE ANSWER`;
- full choices in result evidence;
- optional skip reason;
- stronger numeric normalization;
- table whitespace/overflow bug removed;
- browser-default gray Subject rows removed;
- History overflow menu visually de-emphasized;
- duplicate `A. A.` style option labels normalized;
- new DBD-only app icon/favicon.

This is still Version 1: an execution/evidence system.

---

# 12. What is intentionally not in Version 1.5

The following ideas are reserved for Version 2.0 and should not be backported into 1.5 merely because they are attractive:

- Flashcards;
- progressive walkthroughs;
- interactive teaching slides/states;
- embedded checkpoints inside learning objects;
- campaign phases such as Learn → Recall → Apply → Transfer;
- campaign-level active-time aggregation;
- autonomous repair routing;
- autonomous semantic diagnosis.

The proposed Version-2 direction introduces native **Learning Objects** on top of the stable Base execution layer.

A normal flashcard would be the smallest learning object:

```text
front → reveal → retrieval rating
```

A richer walkthrough could progressively reveal/highlight a shared SVG/table/text scene and include checkpoints.

That is a genuine new architecture, not a Version-1 cleanup.

---

# 13. Deployment

The package is designed for flat GitHub Pages deployment.

Expected root files:

```text
index.html
app.css
app.js
manifest.webmanifest
sw.js
icon-192.png
icon-512.png
favicon-32.png
favicon.svg
README.md
DBD_BASE_PROMPT_PROTOCOL.md
DBD_BASE_PACKET_v1.example.json
```

Keep the same site origin/path when possible so browser-local data under `dbd_gazali` remains available for migration.

Before a major browser/device change, export the ordinary JSON Vault.

Project pages:

- https://gazalied.github.io/
- https://github.com/gazalied/dbdbase

---

# 14. Privacy / platform boundary

DBD Base has no direct OpenAI API integration and no remote account/database requirement.

It does not require:

- ChatGPT API keys;
- Supabase;
- Firebase;
- cloud authentication;
- a remote learner database.

The app runs locally in the browser. AI interaction happens through manually copied prompts and imported packets.

---

# 15. One-sentence product definition

> **DBD Base is a local drill renderer and evidence recorder: the Subject Chat decides what knowledge means; Base makes the learner retrieve/use it and preserves what happened.**
