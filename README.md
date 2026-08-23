# DBD Lite v1.0

**Product:** DBD Lite  
**Version:** 1.0  
**Visible schema:** Schema 7 Lite  
**Internal numeric compatibility:** 7  
**Local storage key:** `dbd_gazali`

DBD Lite is the completed lightweight branch. Full DBD has **not** reached v1.0.

## Product contract

```text
COPY PROMPT
→ subject ChatGPT creates JSON packet
→ IMPORT PACKAGE
→ drill
→ History
```

DBD Lite deliberately does not decide what deserves long-term maintenance.

## What Lite uses

- JSON Session packets;
- existing Session/preflight/drill engine;
- completed and ongoing Sessions;
- History;
- comments/confidence/timing already supported by Sessions;
- local Vault export/merge;
- stable local history.

## What Lite preserves but does not use

Schema-7 data from the experimental full DBD branch may still contain:

- Question Bank records;
- Bank Collections;
- Subject Manifests;
- Stream attempts;
- weighted scheduler configuration;
- alerts / concept urgency / auto-session metadata.

Lite keeps that data for compatibility and historical safety. It does not schedule those Question Bank questions or expose them as current maintenance inventory.

## Schema 7 Lite

The numeric storage schema remains `7`, so current Vaults continue to work. The Lite product labels the storage generation **Schema 7 Lite**.

## Visual identity

The header contains a diagonal CSS/HTML `LITE` ribbon inspired by the provided reference image, using the same DBD black/yellow palette and typography. No image asset is used for that badge.

## Prompt behavior

Home exposes two primary actions: **COPY PROMPT** and **IMPORT PACKAGE**. The prompt tells the subject chatbot to think/audit before producing a compatible JSON drill packet. If a generated prompt exceeds the clipboard comfort threshold, DBD Lite downloads it as a `.md` file.

## Historical rule

> History is permanent. Lite functionality may ignore old experimental systems without deleting their data.


---

## Historical development notes


# v0.9.9-dev2 — Schema 7 / Fast Drill beta

v0.9.9-dev2 is the second 0.9.9 development build. It keeps the weighted evidence engine from dev1 but changes the product around it.

## What dev1 taught us

The scheduler was becoming smarter faster than the actual drill experience.

The dev2 rule is:

> **The scheduler is not the product. The drill is the product.**

DBD usefulness is treated as roughly:

```text
question intelligence
× scheduler intelligence
× interaction speed
```

## Schema 7

Schema 7 extends Schema 6 with two first-class entities:

### Subject Manifests

Each subject can have one authoritative, versioned ontology:

- stable subject ID;
- canonical subject name;
- aliases;
- namespace;
- revision;
- stable concept IDs;
- canonical concept names;
- hierarchy;
- aliases and prerequisites.

A chatbot generating more questions receives the existing Subject Manifest and must reuse its IDs instead of rebuilding concept names from scratch.

### Bank Collections

Question Bank records are grouped into reusable collections.

Collections can be:

- ACTIVE
- PAUSED
- RETIRED
- QUARANTINED

Retiring a collection stops future scheduling but never removes completed Sessions or past Stream attempts.

Schema-6 / legacy Bank questions are migrated generically into collections. Nothing is hard-coded to one SAT Bank.

## Fast Drill UI

Home is now essentially the Stream.

Removed from normal Home:

- Stream Diet panel;
- alert dashboard;
- Bank-management dashboard;
- Auto Session dropdowns;
- engine score display;
- Data controls.

Those capabilities still exist, but are moved to Subjects or Settings.

Native Bank MCQs render as native choices. DBD no longer turns every Bank MCQ into a proposed-answer True/False wrapper.

Routine correct answers advance after a very short feedback flash; wrong answers briefly show the correct response and explanation.

## Subjects

Subject pages are action-first:

- Quick Drill
- recommended Auto Session
- Generation Request
- Import Package
- Needs Attention
- Bank Collection lifecycle

Ontology, Stream policy, and diagnostics live under Advanced.

## History

History now presents learning events:

- completed Sessions;
- aggregated Stream Bursts.

Individual Stream attempts remain preserved in the Vault and evidence model.

## DBD Generation Protocol v2

The old "make ~100 conceptual questions" prompt is replaced by a stricter doctrine.

The model must silently design and audit before exporting:

1. identify real performance targets;
2. decompose them into retrieval primitives;
3. identify realistic failure modes;
4. allocate probes by learning value rather than equal quotas;
5. generate genuinely different variants;
6. audit/reject weak candidates;
7. export only high-value questions.

The prompt explicitly says not to expose private chain-of-thought.

### Prompt-size behavior

Subject-specific Generation Requests contain the doctrine, Subject Manifest, Bank inventory, and current evidence.

If a request exceeds the app's clipboard comfort threshold, DBD automatically downloads:

```text
dbd-<subject>-generation-request-YYYY-MM-DD.md
```

It never falls back to `.txt`.

## Migration guarantee

The stable browser key remains:

```text
dbd_gazali
```

The constitutional data rule remains:

> **History is permanent; eligibility is temporary.**

v0.9.9-dev2 may classify, group, retire, map, and reweight old data. It must not silently erase the historical fact that an attempt occurred.


---

# DBD — Drill Baby Drill

A local-first, mobile-first retrieval and drill engine for AI-generated practice.

DBD is built around a strict separation of responsibilities:

> **The chat understands and generates. DBD schedules, conducts, and preserves the evidence.**

Subject-specific chats remain responsible for understanding materials, teaching concepts, diagnosing weaknesses, tracking the current syllabus, and generating DBD packages. DBD is the execution and retrieval layer.

**Current version: **v0.9.9-dev2**Current data schema:** Schema 7

---

## Overview

DBD began as a lightweight quiz runner and has evolved into two complementary modes:

- **Stream** — instant, low-friction retrieval for spare moments.
- **Session** — deliberate drills, mastery checks, exam simulations, and longer problem-solving.

The long-term product target is:

> **Open DBD → retrieve something useful → answer → leave.**

Deep learning still happens in class, with notes, pen and paper, tutoring, and ChatGPT. DBD exists to keep that knowledge retrievable over time.

No API key is required.

---

## Product model

DBD separates five different layers:

```text
HISTORY
What happened before?
        ↓
KNOWLEDGE STRUCTURE
What subjects and concepts exist?
        ↓
QUESTION BANK
What reusable questions are available?
        ↓
STREAM POLICY
What am I choosing to drill now?
        ↓
SCHEDULER
Which concept and question should appear next?
```

This means old evidence can remain permanently preserved while current Stream priorities change freely.

Muting a subject does **not** delete its sessions, concepts, question history, or diagnostics. It only removes that subject from current Stream selection.

---

## Design principles

### Local-first

All DBD data is stored in the browser under the stable localStorage key:

```text
dbd_gazali
```

DBD can run without a backend or account system.

### No direct AI integration

DBD does **not** directly integrate with:

- ChatGPT API
- OpenAI API
- Supabase
- Firebase
- cloud authentication
- remote user databases

AI interaction remains manual through copied prompts and imported JSON packages.

### Mobile-first

The interface is designed primarily for phone use:

- large touch targets
- one-handed question controls
- compact navigation
- resumable Sessions
- instant Stream access
- minimal setup before retrieval

### Evidence over activity

DBD is not built to reward question counts alone.

Useful evidence includes:

- correctness
- confidence
- guesses
- uncertainty
- `I don't know`
- skips
- timing
- comments
- repeated concept failures
- question variety
- difficulty
- evidence age
- Stream vs Session provenance

---


# Current architecture — v0.9.8.4.1

This section explains the application **as it exists now**. It assumes the reader has never used DBD before.

## What DBD is

DBD is a browser-based retrieval and assessment engine.

It does not teach the lesson itself. Teaching, explanation, uploaded school materials, syllabus interpretation, and generation of new practice material happen outside DBD, normally in a subject-specific ChatGPT conversation.

DBD receives structured practice material, presents it, records what happened, and turns those attempts into reusable evidence.

The current architecture has two user-facing ways to answer questions:

```text
STREAM
fast, recurring retrieval from a reusable Question Bank

SESSION
a deliberate packet of questions taken together
```

They share the same local database, but they are not the same object.

---

## The complete current data flow

At the highest level, v0.9.8.4.1 works like this:

```text
                          ┌──────────────────────┐
                          │ SUBJECT CHAT / CLASS │
                          │ teaching + materials │
                          └──────────┬───────────┘
                                     │
                     generates JSON │
                                     ▼
              ┌─────────────────────────────────┐
              │            DBD IMPORT            │
              └───────────────┬─────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
       SESSION PACKET                KNOWLEDGE / BANK
                │                           │
                ▼                           ▼
          deliberate quiz             QUESTION BANK
                │                           │
                ▼                           ▼
       SESSION ATTEMPTS          CONCEPT MODEL / EVIDENCE
                │                           │
                └─────────────┬─────────────┘
                              ▼
                        LOCAL DATABASE
                         dbd_gazali
                              │
                     ┌────────┴─────────┐
                     ▼                  ▼
                  HISTORY            SCHEDULER
                                         │
                                  STREAM POLICY
                                         │
                                         ▼
                                      STREAM
                                         │
                                         ▼
                                  STREAM ATTEMPTS
                                         │
                                         └──→ evidence updates
```

Every important record remains local to the browser unless the learner explicitly exports a Vault.

---

## 1. The local database

DBD stores its state under:

```text
dbd_gazali
```

The current application schema is Schema 5.

The database contains several kinds of information:

- completed Sessions;
- unfinished Sessions;
- Session attempts;
- the canonical Subject Registry;
- subject aliases;
- Stream Policy settings;
- Concept Manifests;
- the reusable Question Bank;
- Stream attempts;
- question-seen counts;
- recent concept retrievals;
- concept evidence derived from attempts;
- scheduler state;
- local application settings.

The browser database is the source of truth for that device.

Updating the GitHub Pages application does not intentionally erase this database.

---

## 2. Subject Registry

A subject is the top-level learning lane in DBD.

Examples:

```text
SAT Math
Chemistry
Physics
Geography
Matematika Tingkat Lanjut
```

Historical files may use several labels for what is really the same subject. The Subject Registry resolves aliases without rewriting the original history.

For example:

```text
Geografi
OSN Geografi
OSN Geografi SMA
        ↓
canonical subject: Geografi
```

A canonical subject also stores current Stream Policy:

- active or muted;
- Stream Diet weight;
- target difficulty;
- whether historical legacy questions are allowed in Stream.

The Subject Registry therefore answers:

> Which subject does this evidence belong to, and is this subject currently allowed to appear in Stream?

---

## 3. Concept Model

A concept is the unit DBD tries to track.

Examples in SAT Math could be:

```text
Linear equations
Systems of equations
Quadratics
Percentages
Circle geometry
```

Concepts can come from three sources in the current version.

### A. Concept Manifest

A Concept Manifest is the best structured source.

It can define:

- stable concept IDs;
- human-readable names;
- parent / child hierarchy;
- aliases;
- optional prerequisite links;
- manifest revision.

This produces the canonical Tree and Graph views.

### B. Historical legacy tags

Old Session questions may only contain flat tags.

DBD can interpret those tags as provisional concepts so old evidence remains useful.

### C. Question Bank concepts

**v0.9.8.4.1 adds this path.**

A Question Bank no longer requires a Concept Manifest before it can be used.

If Bank questions refer to concepts but the subject has no Manifest yet, DBD creates **provisional Bank concepts** automatically.

Example:

```text
100 SAT Math Bank questions
        ↓
questions reference:
linear_equations
quadratics
percentages
        ↓
DBD creates provisional concepts:
Linear Equations
Quadratics
Percentages
        ↓
Stream can begin immediately
```

If a Bank question contains no concept metadata at all, DBD assigns it to a provisional `General Bank` concept instead of making the question unusable.

A later Concept Manifest may provide the proper canonical hierarchy. The Manifest improves the map; it is not a gate that must be passed before Bank questions can enter Stream.

---

## 4. Concept Tree and Concept Graph

The **Tree** is the primary structured view.

Example:

```text
SAT Math
├── Algebra
│   ├── Linear equations
│   └── Systems
├── Advanced Math
│   └── Quadratics
└── Geometry
    └── Circles
```

The **Graph** is a secondary diagnostic view for hierarchy and cross-links.

The Tree and Graph do not contain lessons or notes. They exist to help DBD understand:

- where a question belongs;
- which concept is weak;
- which concept should be scheduled;
- how evidence should be summarized.

---

## 5. Question Bank

The Question Bank is **reusable inventory**.

A Bank of 100 questions does **not** mean the learner must answer a 100-question quiz.

Instead:

```text
100 Question Bank items
        ↓
scheduler reservoir
        ↓
5-question Stream Burst
        ↓
leave
        ↓
later
        ↓
another Burst
```

Each Bank question can contain:

- stable question ID;
- subject;
- primary concept;
- optional secondary concepts;
- difficulty;
- question type;
- answer;
- explanation;
- Stream eligibility;
- paper requirement;
- calculator requirement.

For Stream, DBD currently prefers quick, objectively gradable items that do not require paper or a calculator.

The Bank is now self-sufficient enough to bootstrap provisional concepts if a Manifest is missing.

---

## 6. Session Packet

A Session Packet is different from a Bank.

A Session says:

> Take this collection together now.

Typical Session purposes are:

- Coverage Scan;
- Focused Drill;
- Deep Practice;
- Repair Drill;
- Mastery Check;
- Exam Simulation.

Sessions can contain longer or more procedural questions than Stream.

A completed Session is preserved in History and contributes evidence.

---

## 7. Stream Policy

History and current priorities are deliberately separated.

A subject can contain years of evidence and still be muted today.

Stream Policy determines which subjects are allowed to feed the scheduler.

Current controls include:

```text
ACTIVE / MUTED
Stream Diet weight
Adaptive / Easy / Medium / Hard difficulty focus
Legacy questions ALLOWED / BANK ONLY
```

Example:

```text
SAT Math       5× active
Geography      muted
```

This does not delete Geography. It simply prevents Geography from currently feeding Stream.

`BANK ONLY` means historical questions remain evidence but cannot be reused as Stream inventory.

---

## 8. Scheduler

The scheduler is concept-first.

Its current decision process is approximately:

```text
1. Read Stream Policy
        ↓
2. Find active subjects with eligible inventory
        ↓
3. Use Stream Diet to determine which subject is underserved
        ↓
4. Build concept evidence inside that subject
        ↓
5. Prefer New / Weak / Shaky / overdue concepts
        ↓
6. Find eligible questions attached to the chosen concept
        ↓
7. Prefer unseen / less-seen questions
        ↓
8. Prefer the requested difficulty when possible
        ↓
9. Serve the question in Stream
```

This is why concepts exist at all: DBD is not trying to randomly draw from a bag of 100 questions. It tries to decide **what knowledge deserves retrieval**, then chooses a question capable of testing it.

v0.9.8.4.1 fixes the missing bridge where a Bank could exist without any concept nodes.

---

## 9. Stream

Stream is the casual retrieval interface at the top of Home.

The normal unit is a finite Burst:

```text
5 questions
↓
Burst complete
↓
Done / 5 more
```

Stream uses Question Bank inventory first and may use eligible historical questions when the subject allows legacy fallback.

A Stream answer creates a Stream Attempt.

That attempt records information such as:

- question ID;
- subject ID;
- concept IDs;
- correctness;
- timestamp;
- evidence source.

The attempt then contributes to concept evidence.

---

## 10. Concept evidence

Concept state is derived from attempts rather than manually assigned.

Current visible states include:

- New
- Shaky
- Weak
- Secure

Evidence may reflect:

- correct vs wrong;
- repeated attempts;
- confidence;
- different question variants;
- retrieval on different days;
- recent failures;
- Stream vs Session source;
- difficulty.

A newly imported concept starts as **New**.

If the learner repeatedly fails it, it can become **Weak**.

Repeated successful retrieval across different questions can eventually make it **Secure**.

The scheduler then reduces pressure on secure concepts and gives more attention to concepts needing retrieval.

---

## 11. Historical fallback

Before dedicated Question Banks existed, DBD could reuse eligible historical multiple-choice questions as Stream cards.

That capability still exists for compatibility.

Per subject:

```text
Legacy questions: ALLOWED
```

permits this fallback.

```text
Legacy questions: BANK ONLY
```

disables it while preserving all historical evidence.

Dedicated Bank questions are preferred for the modern Stream workflow.

---

## 12. Diagnostics loop

The intended learning loop is:

```text
learn in class / ChatGPT
        ↓
import Bank or Session
        ↓
retrieve in DBD
        ↓
DBD accumulates evidence
        ↓
weak concepts become visible
        ↓
Copy Diagnostics
        ↓
paste into subject ChatGPT
        ↓
teach / repair / generate fresh variants
        ↓
import refill
        ↓
DBD again
```

DBD therefore stores evidence, while ChatGPT remains responsible for understanding *why* a learner is failing and how to teach the material.

---

## 13. Vault

Browser storage does not automatically synchronize between devices.

The DBD Vault is the manual portability layer.

Vault export / merge can carry:

- Sessions;
- attempts;
- subjects;
- aliases;
- Stream Policy;
- Concept Manifests;
- Question Bank;
- Stream evidence;
- scheduler-related state.

Stable IDs are used to deduplicate records during merge.

The Vault is not a cloud account and does not provide live synchronization.

---

## 14. What happens when a fresh Bank is imported now

This is the important v0.9.8.4.1 behavior.

### If a Manifest already exists

```text
Bank import
↓
questions map to canonical concept IDs
↓
Question Bank
↓
concept evidence starts as New if untested
↓
scheduler can serve them
```

### If there is no Manifest

```text
Bank import
↓
DBD reads concept references from questions
↓
creates provisional Bank concepts
↓
Question Bank becomes immediately schedulable
↓
Stream can start
```

### If the Bank has no concept metadata

```text
Bank import
↓
General Bank provisional concept
↓
questions remain usable
↓
Stream can start
```

The system no longer permits the specific broken state:

```text
100 valid Bank questions
0 concepts
therefore nothing can be scheduled
```

---

## 15. The architecture in one sentence

> **Subjects organize the lanes, concepts describe what knowledge is being tested, the Question Bank supplies reusable questions, Stream Policy decides what matters now, the scheduler chooses what deserves retrieval, Stream and Session create attempts, and those attempts become evidence that guides the next retrieval.**

---

## 16. Current architecture vs the intended stable v1

v0.9.8.4.1 is still a beta implementation of the v1 idea.

The intended stable v1 keeps the same fundamental loop:

```text
Subject Registry
↓
Concept Model
↓
Question Bank
↓
Stream Policy
↓
Scheduler
↓
Stream / Session
↓
Evidence
↺
```

Future stabilization is mainly expected to improve:

- concept canonicalization;
- provisional-to-Manifest mapping;
- scheduler tuning;
- performance;
- Vault conflict handling;
- diagnostics;
- mobile reliability.

The current architecture is therefore already the v1-style architecture in beta form rather than a separate older quiz-runner model.


---


# v0.9.9 current architecture — Intelligence Architecture

This section describes DBD **as it exists in v0.9.9**.

## The central rule

DBD now separates persisted evidence from derived intelligence.

```text
PERSISTED
what actually happened
        ↓
WEIGHT ENGINE
what that evidence means right now
        ↓
SCHEDULER / ALERT ENGINE / AUTO SESSION COMPOSER
what DBD should do next
```

DBD does not permanently store a concept as “83 points weak” or a question as “priority 92” and treat that number as truth.

Instead it stores the underlying facts:

- attempts;
- timestamps;
- correctness;
- confidence;
- concept links;
- question identity;
- question difficulty;
- question-quality comments/flags;
- Stream Policy;
- question exposure;
- Session provenance.

The v0.9.9 scheduler recalculates priority from those facts.

This means scheduler coefficients can be tuned later without destroying historical evidence.

---

## Schema 6

Schema 6 extends Schema 5 rather than replacing the historical database.

Important first-class state includes:

```text
completedSessions
activeSessions
subjectRegistry
conceptManifests
questionBank
streamEngine

schedulerConfig
questionFeedback
alertState
engineMetadata
autoSessionState
```

The localStorage key remains:

```text
dbd_gazali
```

### `schedulerConfig`

Contains the deterministic scheduler policy:

- algorithm version;
- coefficients;
- thresholds;
- Auto Session composition limits.

### `questionFeedback`

Stores explicit learner evidence about the **quality of a question**, not mastery of the concept.

A Stream question can receive:

- a free-form comment;
- Good question;
- Too easy;
- Too hard;
- Ambiguous;
- Not useful;
- Bad concept match.

### `alertState`

Alerts themselves are normally derived from current evidence.

Only interaction state such as a temporary dismissal needs to be persisted.

### `engineMetadata`

Records which scheduler version is currently interpreting the evidence.

### `autoSessionState`

Tracks the most recent locally composed Session without creating a separate Session engine.

---

## Two kinds of intelligence

DBD does not use an LLM internally.

Its intelligence is deterministic:

```text
measurement
ranking
spacing
selection
aggregation
thresholding
session composition
```

ChatGPT remains responsible for semantic work:

```text
teaching
explanation
new question generation
syllabus interpretation
concept restructuring
deep diagnosis
```

This division is intentional.

---

## The weighted scheduler

The scheduler operates in layers.

### Layer 1 — Subject policy

The Stream Diet answers:

> Which subject currently deserves Stream capacity?

Muted subjects receive no Stream questions.

Subject weights allocate retrieval strategically.

### Layer 2 — Concept urgency

Inside the chosen subject, v0.9.9 can consider signals such as:

- New concept;
- weighted correctness;
- recent failures;
- uncertainty / guessing / IDK;
- overdue retrieval;
- Secure-state penalty;
- repetition of the same concept in recent Stream history.

### Layer 3 — Question suitability

For questions that can test the chosen concept, DBD can consider:

- unseen-question bonus;
- repeated-question penalty;
- very-recent-question penalty;
- difficulty fit;
- explicit question-quality feedback;
- preference for dedicated Question Bank inventory.

### Explainability

The Stream card includes **WHY THIS?**

It displays the score components that produced the current choice.

The final score is a scheduling decision, not a permanent learning measurement.

---

## Stream question feedback

Stream now has a Comment control similar in purpose to Session comments.

This solves a different problem from correctness.

A learner may correctly answer a question and still say:

```text
This is too trivial to be useful SAT practice.
```

That is evidence about the **question**, not evidence that the underlying concept is mastered.

v0.9.9 therefore maintains two distinct evidence families:

```text
CONCEPT EVIDENCE
How well can I retrieve/apply this knowledge?

QUESTION EVIDENCE
How useful is this item as a probe?
```

Repeated negative question-quality signals reduce that item's future suitability.

---

## Alert engine

Alerts are derived locally from stored evidence.

Current alert classes include:

- weak concepts needing repair;
- low unseen Bank inventory;
- active subjects neglected for a long period;
- questions accumulating repeated negative quality signals.

Alerts do not require ChatGPT or a server.

The beta alert system is primarily an **in-app attention layer**, not OS-level background push notification infrastructure.

---

## Auto Session Composer

A major v0.9.9 addition is the ability to create deliberate Sessions without going to ChatGPT first.

The Composer does **not generate new questions**.

It selects existing Question Bank inventory.

```text
Question Bank
+
concept evidence
+
scheduler weights
        ↓
Auto Session Composer
        ↓
ordinary DBD Session
```

Current composition modes:

- Repair;
- Due Review;
- Mastery Check;
- Smart Mixed.

Once composed, the result enters the existing Session engine.

There is therefore still only one Session runner.

Sessions can originate from:

```text
ChatGPT imported packet
OR
DBD Auto Session Composer
```

---

## Stream versus Auto Session

Both use the same evidence base but answer different questions.

```text
STREAM
What is the best next retrieval?

AUTO SESSION
What is the best coherent set of questions for a deliberate drill?
```

Stream remains a five-question Burst system.

Auto Session creates a larger deliberate set from the Bank.

---

## Alerts, scheduler, and Auto Session share one evidence model

This is the defining v0.9.9 architectural change.

```text
                    QUESTION BANK
                         │
                         ▼
                  EVIDENCE ENGINE
                         │
          ┌──────────────┼───────────────┐
          ▼              ▼               ▼
      SCHEDULER        ALERTS       AUTO SESSION
          │                              │
          ▼                              ▼
        STREAM                         SESSION
          │                              │
          └────────── ATTEMPTS ──────────┘
                         │
                         ▼
                    NEW EVIDENCE
                         ↺
```

The system does not maintain three unrelated definitions of weakness.

They draw from the same stored attempts and concept model.

---

## Question Bank and Concept Manifest

A Question Bank is sufficient to start retrieval.

A Concept Manifest is not a gatekeeper.

If canonical concepts are unavailable, Bank questions can bootstrap provisional concepts.

A later Manifest can improve the hierarchy and aliases.

```text
Bank
↓
provisional concepts
↓
Stream works immediately

Manifest later
↓
canonicalized structure
```

---

## Vault behavior under Schema 6

Vault merge now carries the additional v0.9.9 evidence:

- Stream attempts;
- question-quality feedback;
- alert dismissal state;
- scheduler configuration;
- Auto Session provenance;
- subject policy;
- concepts/manifests;
- Question Bank;
- Sessions.

Attempts and feedback records remain ID-based so merges can deduplicate them.

The Vault remains manual portability rather than live cloud sync.

---

## What v0.9.9 still cannot do offline

DBD can autonomously select and compose practice from information already structured in its database.

It cannot reliably:

- understand arbitrary new curriculum text;
- decide sophisticated semantic equivalence between novel labels;
- generate genuinely new questions;
- teach a misunderstood concept;
- infer a new syllabus from raw prose;
- provide deep natural-language diagnosis.

Those jobs stay with ChatGPT / teachers / tutors.

The intended relationship is:

> **ChatGPT has semantic authority. DBD has empirical authority.**



---

# Stream

Stream is the fast retrieval layer.

It is intended for moments such as:

- public transport
- waiting for class
- short breaks
- spare minutes
- situations where pen, paper, and calculators are inconvenient

Stream should primarily use questions that can be solved mentally or with minimal working, including:

- conceptual distinctions
- method selection
- error detection
- equation or formula interpretation
- qualitative relationships
- classification
- prediction
- short mental calculations

Long scratch-work-heavy questions belong in Session.

---

## Stream Bursts

Stream is consumed in short finite Bursts.

The default beta structure is:

```text
5 questions
↓
Burst complete
↓
Done or 5 more
```

DBD should be easy to start without becoming an infinite-scroll engagement loop.

---

## Stream Diet

v0.9.8.3 introduces a dedicated **Stream Policy** layer.

Each canonical subject can be:

- **Active**
- **Muted**

Each active subject also has:

- Stream weight
- target difficulty
- legacy-question policy

Example:

```text
SAT Math       3×
Math Lanjut    2×
Chemistry      1×

Geography      Muted
Physics        Muted
```

Weights are proportional over repeated retrievals.

DBD uses the Stream Diet for macro subject allocation, then the scheduler chooses the best concept and question inside the selected subject.

### Legacy question policy

Each subject can use either:

- **Legacy allowed** — dedicated Question Bank + eligible historical questions.
- **Bank only** — old history remains evidence, but only newly imported Bank questions may appear in Stream.

`Bank only` is useful when a subject moves to a new syllabus, harder level, competition phase, or otherwise makes old questions obsolete.

---

# Session

Session is the deliberate side of DBD.

Use Session for:

- Coverage Scan
- Focused Drill
- Deep Practice
- Repair Drill
- Mastery Check
- Exam Simulation

Session supports longer and more procedural work than Stream.

### Session workflow

```text
Subject chat
    ↓
Generate Session JSON
    ↓
Import Packet
    ↓
Preflight
    ↓
Run Session
    ↓
Results
    ↓
Diagnostics / Pure Results
    ↓
Subject chat
```

### Working styles

- **No pen or paper** — conceptual and mental testing.
- **Full problem solving** — written working is permitted or required.

### Answer formats

Supported Session formats include:

- multiple choice
- short answer
- numeric
- mixed
- essay / rubric-based self-assessment

Essay questions are not fake-auto-graded. They use reference answers and rubrics for learner self-assessment.

### Confidence and honesty states

DBD distinguishes correctness from confidence:

- **Sure**
- **Not sure**
- **Ngasal**
- **I don't know**
- **Skip**
- **Flag**

A correct guess is not treated as the same evidence as a confident correct answer.

---

# Subjects

Subjects are not permanently hard-coded into the application.

DBD detects subject labels from historical data and resolves them through a canonical Subject Registry.

For example:

```text
Geografi
OSN Geografi
OSN Geografi SMA
```

may resolve to one canonical subject:

```text
Geografi
```

while preserving the old names as aliases.

The Subject Registry stores:

- canonical name
- aliases
- Stream activation state
- Stream weight
- target difficulty
- legacy-question policy
- policy update timestamp

Manual subject organization remains available as a fallback for ambiguous cases.

---

# Concept architecture

DBD v0.9.8.x introduces the first v1-style knowledge structure.

The key distinction is:

```text
Tag
= arbitrary metadata attached to an old question

Concept
= a stable piece of knowledge deliberately tracked over time
```

Legacy tags remain untouched in historical records.

A mapping layer interprets them against newer canonical concepts.

---

## Concept Tree

The Concept Tree is the primary human-readable knowledge structure.

Example:

```text
SAT Math
├── Algebra
│   ├── Linear equations
│   ├── Linear functions
│   ├── Systems of equations
│   └── Inequalities
├── Advanced Math
│   ├── Quadratics
│   ├── Exponents
│   ├── Polynomials
│   └── Nonlinear equations
├── Problem Solving & Data Analysis
└── Geometry & Trigonometry
```

Tree depth is flexible.

---

## Concept Graph

DBD also includes a secondary Graph view for:

- hierarchy
- prerequisites
- cross-concept relationships

The graph is intentionally not a primary Home feature. The tree remains the normal interface.

---

## Concept Manifests

A Concept Manifest defines a canonical subject structure.

At a high level it contains:

- subject identity
- concept IDs
- concept names
- parent relationships
- aliases
- optional prerequisite links
- manifest revision

Updated manifests extend or revise the same subject rather than creating a duplicate.

---

## Legacy mapping

Historical DBD records remain source evidence and are not rewritten.

```text
OLD DATA
sessions
questions
flat tags
attempts
        ↓
LEGACY MAPPING
subject aliases
tag aliases
provisional relationships
        ↓
CANONICAL SUBJECTS
AND CONCEPTS
        ↓
CURRENT EVIDENCE
```

This keeps migration reversible.

---

## Concept states

Concept evidence can resolve into:

- New
- Shaky
- Weak
- Secure

A concept should not become Secure from one lucky question.

Evidence can consider:

- repeated retrieval
- correctness
- confidence
- question variety
- different retrieval days
- difficulty
- Stream vs Session context
- evidence age

Child performance may influence parent summaries. Parent performance does not automatically prove every child concept.

---

# Question Bank

A Question Bank is reusable Stream inventory.

This is different from a Session packet.

```text
SESSION PACKET
Take these questions together now.

QUESTION BANK
Store these questions and retrieve them gradually over time.
```

A normal Stream Bank may contain around **100 questions** because they are consumed in short Bursts rather than as a 100-question test.

Bank / Knowledge Packages may contain:

- Concept Manifest
- reusable questions
- stable concept IDs
- difficulty
- Stream eligibility
- paper/calculator requirements

DBD excludes questions from Stream when they require paper, calculators, or long procedural working.

---

# Scheduler

The v1 scheduler is deterministic and concept-first.

It begins with:

> **Which concept deserves retrieval?**

Then:

```text
Choose subject according to Stream Diet
        ↓
Choose weak / new / due concept
        ↓
Find eligible questions for that concept
        ↓
Prefer fresh / unseen variants
        ↓
Respect difficulty target
        ↓
Serve question
```

Concept priority can rise because of:

- wrong answers
- `I don't know`
- uncertainty
- guessing
- overdue retrieval
- new-material pressure
- weak evidence
- underexposure

Priority can fall because of:

- repeated secure retrieval
- very recent exposure
- repetition inside the current Burst

---

# Reports

DBD produces two main Session outputs.

### Copy Pure Results

A neutral factual record for archiving, comparison, or sharing raw performance.

### Copy Diagnostics

Designed for sending back to a subject chat. It can include:

- weak concepts
- uncertainty
- guesses
- don't-know responses
- timing
- comments
- wrong questions
- concept evidence

Subjects can also produce subject-level diagnostics for ChatGPT.

---

# Data and Vault

## Local persistence

DBD uses browser-local storage under:

```text
dbd_gazali
```

Data normally survives page reloads, browser restarts, and GitHub Pages application updates on the same origin.

## DBD Vault

Because localStorage is device-specific, DBD supports portable Vault files.

Vault export / merge can carry:

- Sessions
- attempts
- canonical subjects
- aliases
- Stream policies
- Concept Manifests
- Question Bank inventory
- Stream attempts
- scheduler evidence
- settings

Stable IDs help prevent duplicate attempts during merges.

Vault merge is **not** live cloud synchronization.

## Data health

The Data page can surface:

- orphan concept links
- duplicate Question Bank IDs
- unresolved legacy tags
- schema version
- local database size

---

# JSON packages

DBD supports several conceptual package roles:

- **Session packet** — deliberate quiz.
- **Question Bank package** — reusable Stream inventory.
- **Knowledge Package** — Concept Manifest + Question Bank.

### Session packet example

```json
{
  "dbd_version": "0.9.8.3",
  "campaign": "School",
  "subject": "Matematika Tingkat Lanjut",
  "topic": "Polynomials",
  "source": "Current subject-chat materials",
  "test_type": "coverage_scan",
  "working_style": "no_paper",
  "answer_format": "mcq",
  "difficulty": "adaptive",
  "feedback": "immediate",
  "timing": "record_only",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Which expression is a polynomial in x?",
      "choices": {
        "A": "3x^2 - 2x + 1",
        "B": "x^-1 + 2",
        "C": "sqrt(x) + 1",
        "D": "1/(x+1)"
      },
      "answer": "A",
      "explanation": "A polynomial uses non-negative integer exponents of the variable.",
      "tags": ["polynomial definition"],
      "difficulty": "easy",
      "paper_required": false
    }
  ]
}
```

### Common question fields

| Field | Purpose |
| --- | --- |
| `id` | Stable question identifier |
| `type` | Question type |
| `prompt` | Main question text |
| `stimulus` | Optional quote, passage, or context |
| `choices` | Multiple-choice options |
| `answer` | Correct answer |
| `accepted_answers` | Alternative valid typed answers |
| `tolerance` | Numeric tolerance |
| `explanation` | Post-answer explanation |
| `why_wrong` | Distractor-specific explanation |
| `tags` | Legacy / auxiliary skill labels |
| `concept_ids` | Canonical concepts tested |
| `primary_concept_id` | Main concept receiving evidence |
| `difficulty` | Easy, medium, or hard |
| `paper_required` | Whether scratch work is required |
| `calculator_required` | Whether calculator use is required |
| `stream_eligible` | Whether the question may appear in Stream |
| `time_limit_seconds` | Optional Session time limit |

---

# Running locally

DBD is a static web application.

No backend is required.

### GitHub Pages

Upload the production files to the repository root and serve them with GitHub Pages.

During the current beta, stale service-worker caching is intentionally minimized because earlier PWA caching caused startup problems on a heavily used Chrome Android profile.

### Local server

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

# Current project structure

As of v0.9.8.4, production code is split into dedicated HTML, CSS, and JavaScript files, but all application files remain at the repository root for simple GitHub Pages deployment.

```text
/
├── index.html
├── app.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── icon-192.png
├── icon-512.png
└── README.md
```

There is no required `assets/`, `css/`, or `js/` subfolder.

This structural cleanup does not change the stable `dbd_gazali` storage key or rewrite historical evidence.

---

# Known beta issues

## Stream preparation

On large legacy databases, the concept/scheduler engine may take noticeable time to index local evidence before the first Stream question becomes available.

The current beta may display:

```text
Preparing Stream
DBD is indexing your local legacy evidence.
```

A future patch should:

- provide a real loading/progress screen;
- make clear what phase is being indexed;
- avoid blocking unrelated Home controls;
- keep **Stream Diet fully interactive while Stream is preparing**;
- progressively build indexes instead of appearing frozen;
- reduce repeated work on large legacy databases.

## Code organization

v0.9.8.4 separates markup, styling, and application logic while keeping all production files at the repository root for straightforward GitHub Pages deployment.

## Release documentation

Future GitHub Pages packages should use:

```text
README.md
```

not `README.txt`.

---

# Changelog


## v0.9.9 — Intelligence Architecture

### Data architecture

- Migrated the application to **Schema 6**.
- Preserved the stable `dbd_gazali` localStorage key.
- Added first-class:
  - `schedulerConfig`
  - `questionFeedback`
  - `alertState`
  - `engineMetadata`
  - `autoSessionState`
- Schema 5 evidence migrates forward without rewriting completed historical Sessions.

### Weighted scheduler

- Replaced the simpler beta priority calculation with an explicit multi-signal weighting engine.
- Separates:
  - subject allocation;
  - concept urgency;
  - question suitability.
- Current signals include:
  - Stream Diet deficit;
  - New concept pressure;
  - weakness;
  - recent failures;
  - uncertainty;
  - overdue retrieval;
  - Secure penalty;
  - recent-concept repetition;
  - unseen question bonus;
  - seen-question penalty;
  - very-recent question penalty;
  - difficulty fit;
  - question-quality feedback;
  - dedicated Bank preference.
- Added scheduler algorithm versioning.

### Scheduler transparency

- Added **WHY THIS?** to Stream.
- Displays the current question's score components and final scheduling priority.
- Scheduler scores are derived, not permanent mastery values.

### Stream comments and question quality

- Added Stream comments.
- Added quick quality signals:
  - Good question
  - Too easy
  - Too hard
  - Ambiguous
  - Not useful
  - Bad concept match
- Question-quality feedback is stored separately from concept mastery evidence.
- Negative quality evidence can reduce a question's future scheduler suitability.

### Alerts

- Added local derived alerts for:
  - weak concepts;
  - low unseen Bank inventory;
  - neglected active subjects;
  - repeated negative question-quality feedback.
- Added 24-hour alert dismissal state.

### Auto Sessions

- Added local Question-Bank Session composition.
- Current modes:
  - Repair
  - Due Review
  - Mastery Check
  - Smart Mixed
- Auto Sessions use the existing Session runner.
- DBD selects existing Bank questions; it does not generate new questions offline.
- Auto Session provenance is preserved with completed Sessions.

### Vault

- Schema 6 Vault merge includes:
  - question-quality feedback;
  - alert dismissal state;
  - Stream evidence;
  - scheduler policy;
  - Auto Session state/provenance.

### Product boundary

> ChatGPT has semantic authority. DBD has empirical authority.

DBD remains local-first and deterministic rather than adding an AI API.




## v0.9.8.4.1 rewrite r2 — Bank scheduling hardening

This is a rewritten build of the same semantic version, not a new feature version.

### Why the first 0.9.8.4.1 build could still appear unfixed

Two independent failure paths were possible:

1. GitHub Pages / Chrome could continue serving a previously cached root `app.js` because the filename did not change.
2. The scheduler still relied too heavily on successful Concept Model construction before selecting a Bank item.

### What r2 changes

- `index.html` now requests:
  - `app.css?v=09841r2`
  - `app.js?v=09841r2`
- This forces the browser to request the rewritten assets instead of silently reusing the earlier script.
- Every active subject with at least one Stream-safe Bank item is now directly schedulable.
- Question Bank inventory itself creates provisional concepts.
- If concept construction unexpectedly fails, the scheduler has a final direct-Bank fallback.
- A Manifest remains useful for canonical hierarchy but is never required to make valid Bank inventory appear in Stream.
- Existing Question Bank records are repaired in place when concept metadata is incomplete.
- The Data page displays build ID `09841-r2`, making it possible to verify that the rewritten JavaScript actually loaded.

### Verification

After deployment, open:

```text
Data
```

and confirm:

```text
Version  0.9.8.4.1
Build    09841-r2
```

If the Build line is not `09841-r2`, the browser is not running this rewritten package.




## v0.9.8.4.1 — Bank-to-Concept bridge

### Fixed

- A subject could contain a valid Question Bank but zero Concept nodes, causing Stream to report **No drillable concept could be resolved**.
- Existing Bank-only subjects are repaired on startup without requiring the Bank to be re-imported.
- Bank questions with concept IDs now bootstrap provisional concepts when no Concept Manifest exists.
- Bank questions with no concept metadata fall back to a schedulable **General Bank** concept.

### Added

- Provisional concepts sourced directly from Question Bank inventory.
- Human-readable provisional concept labels derived from Bank concept IDs.
- Preservation of concept display names on future Bank imports.
- Bank view now explains that a Manifest is optional for initial Stream use.

### Architecture change

A Concept Manifest is now an optional canonicalization layer rather than a prerequisite for Stream.

```text
Question Bank
↓
provisional concepts if necessary
↓
scheduler
↓
Stream

Concept Manifest later
↓
canonical hierarchy
```

### Compatibility

- Existing `dbd_gazali` data is preserved.
- Existing Question Bank question IDs are preserved.
- Existing Session and Stream history are preserved.
- Data schema remains Schema 5.


## v0.9.8.4 — Stream startup and code-structure patch

### Fixed

- Endless **Preparing Stream** loop when no eligible Stream question could be produced.
- Scheduler state ambiguity between “not prepared” and “prepared but empty”.
- Long Stream preparation blocking interaction with Stream Diet.

### Added

- Explicit Stream engine state machine.
- Loading phase and progress.
- Empty and error completion states.
- Retry Stream action.
- Browser-yielding per-subject preparation.

### Changed

- Application CSS moved to root-level `app.css`.
- Application JavaScript moved to root-level `app.js`.
- Release packages use `README.md`.
- Data schema moved to Schema 5.


## v0.9.8.3 — Stream Policy beta

### Added

- Stream Diet.
- Proportional subject weights.
- Solo Subject.
- Subject mute / activate.
- Adaptive / Easy / Medium / Hard difficulty focus.
- Legacy allowed / Bank only policy.
- Stream Policy persistence in Vault.
- Schema 4.

### Changed

- Scheduler now separates strategic subject selection from tactical concept selection.
- Historical volume no longer determines current Stream priorities.
- Question Bank remains preferred over historical fallback.
- Subject pages surface Stream policy.
- Newer subject-policy timestamps win during Vault merges.

### Established

> **History says what happened. Knowledge says what exists. Stream Policy says what DBD is allowed to drill now.**

---

## v0.9.8.2 — Stream Bank workflow

### Added

- Dedicated Stream Bank section on Home.
- Add Questions / Knowledge Package import.
- Copy Bank Request.
- Bank inventory inside Subjects.
- Subject-level Copy Diagnostics.
- Stream eligibility metadata.
- `calculator_required`.

### Changed

- Bank-generation prompts target approximately 100 reusable questions.
- Stream prompts prioritize conceptual, mental, no-paper, no-calculator retrieval.
- Long procedural questions remain Session material.
- Refill requests prioritize weak / shaky concepts and fresh variants.

---

## v0.9.8.1 — Stability patch

### Fixed

- Chrome Android startup failure on a heavily used local database.
- Excessive synchronous indexing during initial rendering.
- Repeated expensive legacy/concept calculations.
- Scheduler startup moved after first paint.
- Startup/render failures now show an error state instead of an endless loading screen.

### Changed

- Stream can temporarily show **Preparing Stream**.
- Aggressive service-worker caching was retired during beta.
- Existing `dbd_gazali` data remains untouched.

---

## v0.9.8 — v1 architecture beta

### Added

- Canonical Subject Registry.
- Automatic subject normalization.
- Manual subject merging.
- Concept Manifest system.
- Concept Tree.
- Concept Graph.
- Legacy tag interpretation.
- Concept evidence states.
- Question Bank architecture.
- Concept-first scheduler.
- Knowledge Package import.
- inventory / refill awareness.
- Data Health diagnostics.
- explicit schema versioning.
- Vault support for knowledge entities.

### Changed

- Stream moved from simple historical-card reuse toward concept-first scheduling.
- Historical source records remain immutable while interpretation layers evolve above them.

---

## v0.9.7 — Stream / Session / Subjects preview

### Added

- Stream as the first Home section.
- Prototype True / False retrieval from eligible historical MCQs.
- Session as the deliberate-drill section.
- Dynamic Subjects page.
- Subject-level historical evidence preview.

### Established

```text
STREAM = casual retrieval
SESSION = deliberate testing
```

---

## v0.9.6 — v1 foundation

### Added

- Mergeable DBD Vault.
- Stable IDs for Sessions, packets, questions, and devices.
- Initial dynamic Stream candidates.
- Concept-evidence indexing from historical tags.
- Forward-compatible Question Bank storage.

---

## v0.9.5 — interaction refinement

### Added

- Total Drills and Questions Answered.
- compact Flag pill.
- inline MCQ Check / Next.
- essay support.
- reference answer + rubric self-assessment.
- hidden zero-value confidence categories.

### Changed

- Question Navigator closes by tapping outside.
- comments became more compact.
- mobile overlap problems reduced.

---

## v0.9.4 — visual hierarchy release

### Added

- compact progress header.
- square Pause.
- stacked confidence visualization.
- ranked Weak Areas.
- redesigned History and Data.

### Changed

- reduced nested cards and borders.
- compact confidence / Flag / IDK / Skip / Comment controls.
- preflight disclosures collapsed by default.
- Pure Results became the primary result action.

### Removed

- paperless disclaimer.
- Download Summary TXT.
- Wrong + Slow action.

---

## v0.9.3

### Added

- per-question comments.
- Copy Diagnostics.
- Copy Pure Results.
- integrated questions-left progress.
- feedback-space stabilization.
- fixed top hazard stripe.

---

## v0.9.2

### Added

- collapsible customization.
- Copy Vanilla Instruction.
- pending packets in Ongoing Sessions.
- editable preflight settings.

### Fixed

- imported question-count synchronization.
- mobile preflight layout.

---

## v0.9.1

### Added

- six test types.
- multiple ongoing Sessions.
- Question Navigator.
- Sure / Not sure / Ngasal.
- I don't know.
- Skip.
- Flag.
- paperless conceptual mode.
- AI-set timing.

---

## v0.9

Design milestone. Planned v0.9 concepts were folded into v0.9.1.

---

## v0.8.5

### Added

- answer-format controls.
- AI-set per-question timing.
- Full Quiz History.
- detailed question-level reports.
- preflight customization editing.

---

## v0.8

### Added

- JSON file import.
- drag-and-drop import.
- preflight validation.
- immediate / delayed feedback.
- structured stimuli.
- pause / resume.
- autosave.
- retry wrong.
- timing statistics.
- tag and difficulty reporting.
- downloadable reports.

---

## v0.7

### Added

- single-screen drill builder.
- subject selection.
- drill configuration.
- saved local settings.
- stable `dbd_gazali`.
- backup import/export.
- prompt-generation workflow.
- material-selection gate.

---

## v0.6

### Added

- Gazali-specific campaign structure.
- stable browser persistence.
- storage migration.
- Data page.
- backup tools.
- reset controls.

### Removed

- heavy material-library behavior.
- hard-coded current chapters.
- direct NotebookLM dependency.

---

## v0.5

First clearly defined Gazali-specific DBD MVP.

### Added

- LocalStorage persistence.
- AI prompt generation.
- JSON packet import.
- question-by-question drilling.
- mistake logging.
- basic timing.
- Session reports.
- subject/campaign organization.

### Established

```text
Learn in chat
→ generate packet
→ drill in DBD
→ record mistakes
→ return evidence to chat
```

---

## Pre-v0.5 prototype

The earliest prototype proved:

- AI-generated question packets
- lightweight browser execution
- answer and mistake recording
- separation between teaching and drilling

---

# Roadmap

## v0.9.8.4

Planned only; **not implemented yet**.

Likely focus:

- proper Stream-preparation loading / progress screen
- keep Stream Diet interactive while indexing
- progressive / reduced legacy-evidence indexing
- separate CSS into `css/app.css`
- separate JavaScript into `js/app.js`
- use `README.md` in release packages instead of `README.txt`
- beta performance and mobile reliability work

## v0.9.9

Intended release-candidate phase:

- no major architecture additions
- scheduler tuning
- migration fixes
- Vault conflict fixes
- mobile reliability
- performance
- data integrity
- UI cleanup

## v1.0

Stable Stream / Session / Subject / Concept / Question Bank architecture once the beta has been used enough to trust the scheduler and migration behavior.

---

# Explicitly out of scope

- direct ChatGPT integration
- AI API calls from DBD
- Supabase
- Firebase
- cloud accounts
- server-side student profiles
- automatic live cross-device synchronization
- textbook / note-taking replacement
- turning DBD into a generic knowledge-management system

---

# Status

DBD is an evolving personal retrieval system rather than a general-purpose commercial learning platform.

The current design target is:

> **Deep learning creates knowledge. DBD keeps that knowledge alive.**

Operational loop:

```text
Learn
↓
Generate concepts / questions
↓
Import into DBD
↓
Stream or Session retrieval
↓
Evidence accumulates
↓
Weakness becomes visible
↓
Copy diagnostics back to ChatGPT
↓
Teach / repair / refill
↓
DBD
```
