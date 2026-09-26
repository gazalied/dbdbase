# DBD — Drill Baby Drill

**Current product:** DBD Base 2.0  
**Build:** `base-2.0-r1`  
**Human-facing vault format:** DBD Base Vault v1  
**Browser storage key:** `dbd_gazali`

DBD is a local-first execution and evidence system for AI-generated learning practice.

> **Subject Chat understands. DBD executes and records.**
>
> **Score is evidence, not diagnosis.**

## What changed in 2.0

DBD 1.x was fundamentally a question engine. DBD Base 2.0 adds a second first-class execution surface without turning DBD into an autonomous tutor or an Anki clone.

- **Question Drill Mode** — MCQ, numeric, short answer, essay, tables, safe SVG, calculator evidence, confidence/comments/flags, review and history.
- **Flashcard Recall Mode** — front → reveal → KNEW/MISSED → review missed → resume → exact miss export.

Both modes share Subjects, local persistence, History, Vault, DBD Compact transport, resume state, timing and export infrastructure.

## Product genealogy

### Era 0 — ASAT quiz prototypes
The earliest DBD ancestor was a small offline quiz front end for school exam practice. The core question was simple: can AI-generated practice be loaded into a local app and executed reliably?

### Era 1 — DBD Plus / 0.x experimental architecture
The 0.x line gradually added persistent history, Stream, Question Bank, concept manifests, weighting, scheduler experiments, Auto Sessions and increasingly ambitious retrieval intelligence. These experiments are referred to retrospectively as **DBD Plus**. They never became a final 1.0 product.

Important lesson: scheduling sophistication does not rescue weak questions, bloated runtime or unclear ownership of semantic decisions.

### Era 2 — DBD Lite
DBD Lite deliberately removed the scheduler-heavy architecture and asked what the irreducible useful core was.

### Era 3 — DBD Base 1.0
Base established the durable doctrine: ChatGPT/Subject Chat creates and interprets; DBD renders, runs and records. Base 1.0 evolved through r1–r5 with subject records/aliases, safe SVG, calculator, dark/light themes, table stimuli, compressed transport, richer evidence and deletion/export controls. r5 is the frozen final 1.0 revision.

### Era 4 — DBD Base 1.5
1.5 is the cleanup/consolidation generation: the same quiz institution, with the accumulated UI/runtime lessons treated as one coherent product rather than revision archaeology.

### Era 5 — DBD Base 2.0
2.0 introduces **Recall Mode** as a second execution primitive. It does not introduce autonomous curriculum, spaced repetition, tutoring or a permanent knowledge-management system.

## Architecture

```text
Subject Chat / teacher / tutor
        |
        | authors trustworthy content
        v
DBD Base 2.0
  |-- Question Drill Mode
  |-- Flashcard Recall Mode
  |
  |-- local session state
  |-- evidence / history
  |-- import / export
  |-- DBD Vault / DBD Compact
        |
        v
Subject Chat interprets evidence
```

## Flashcard Recall Mode

### Packet

```json
{
  "packet_type": "flashcards",
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
  "priority": "core",
  "source": "Asthina METKLIM",
  "tags": ["geography", "selection2"]
}
```

`type` is metadata only in 2.0. Supported conventions include `TERM`, `REVERSE`, `CONTRAST`, `MECHANISM` and `FORMULA_RULE`. They intentionally share one runtime.

### Runtime

- Round 1 uses all cards.
- Each card is revealed, then rated **KNEW** or **MISSED**.
- Review Missed creates another legitimate retrieval round containing only misses.
- Review All Again is optional.
- State is saved after every rating so interruption is safe.
- Previous is available to correct accidental ratings in the current round.
- Desktop shortcuts: Space/Enter reveal, `1` Knew, `2` Missed, Left previous.

No spaced-repetition scheduler is included. `last_seen`-style evidence may be recorded, but DBD does not decide when knowledge is due.

## Question Mode

Existing DBD Base question packets remain backwards-compatible. Question Mode remains the right tool for procedure, calculation, application, misconceptions, visual interpretation, integrated reasoning and transfer.

Structured stimulus surfaces remain:

- plain text
- native table
- sanitized SVG

The calculator remains an execution tool and its expression/result trail is evidence.

## Evidence doctrine

DBD must not collapse all learner behavior into one diagnosis. Keep observations separate where possible:

- objective outcome
- answer
- confidence when explicitly selected
- active time
- calculator trail
- comment / flag
- exact flashcards missed
- round history

A UI default is not learner evidence. New question responses therefore do not default confidence to `Sure`.

## History

Normal History is for real, openable Base sessions. Old Stream experiments and Question Bank inventory remain preserved in the Vault/settings for compatibility but are intentionally de-emphasized from the main History timeline.

Question sessions and recall sessions are displayed as distinct evidence types; their scores are not treated as directly interchangeable mastery metrics.

## Home metrics

The home strip is intentionally morale-oriented but factual:

- Completed
- Questions answered
- Subjects

`Questions answered` counts question-session items, not flashcards. Recall performance is visible inside recall session history/results.

## Data / compatibility

The browser key stays `dbd_gazali` so existing local data is not abandoned.

DBD Base 2.0 uses the human-facing format label **DBD Base Vault v1**. Internally, legacy Schema-7-era fields can still be carried for backward compatibility with old Vaults. They are compatibility baggage, not the product identity.

The ordinary JSON Vault remains canonical. DBD Compact remains a lossless transport wrapper for clipboard/messaging transfer.

## What DBD deliberately does not do

- autonomous curriculum planning
- semantic diagnosis
- automatic mastery claims
- spaced repetition / FSRS
- flashcard due-date scheduling
- giant deck-management UI
- AI explanations inside DBD
- XP/streak/gamification systems
- direct OpenAI API calls

## Repository files

- `index.html` — app shell
- `app.css` — visual system
- `app.js` — runtime, storage, renderer, evidence and Recall Mode
- `manifest.webmanifest` — install metadata
- `sw.js` — cache-retirement/service-worker compatibility
- `favicon-32.png`, `favicon.svg`, `icon-192.png`, `icon-512.png` — app identity
- `README.md` — product/history/architecture
- `DBD_BASE_PROMPT_PROTOCOL.md` — generation contract
- `DBD_BASE_PACKET_v2.example.json` — Recall Mode example packet

## Deployment

The package is intentionally flat for GitHub Pages. Upload the files to the same `/dbdbase/` directory and keep `index.html`, `app.css` and `app.js` together.
