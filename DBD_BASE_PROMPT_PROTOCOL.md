# DBD Base 2.0 — Generation Protocol

## Institutional boundary

**Subject Chat / teacher / tutor = semantic authority.**
It understands material, decides scope, teaches, diagnoses mistakes and authors trustworthy practice.

**DBD Base = execution + evidence.**
It renders, runs, resumes, times, records and exports.

> Score is evidence, not diagnosis.

## Two execution surfaces

### Question Drill
Use for procedure, calculation, method choice, misconception testing, application, interpretation, mixed testing and transfer.

Supported types:
- `mcq`
- `multi_select`
- `numeric`
- `short`
- `essay`

`multi_select` uses an answer array and exact-set grading.

### Flashcard Recall
Use for atomic retrieval: terms, definitions, classifications, theories, reverse recognition, short causal chains, formulas/rules, symbol meanings and compact visual identification.

Runtime is deliberately simple:

`front → reveal → KNEW / MISSED`

Do not generate SRS schedules, due dates, ease factors, XP, streaks or autonomous repair logic.

## Shared representation grammar

Both questions and flashcards can use:

### Plain text
Use when prose/equations are sufficient.

### Native table

```json
{
  "type": "table",
  "title": "Data",
  "columns": ["Variable", "Value"],
  "rows": [["m", "100 g"], ["c", "4 J g⁻¹ °C⁻¹"]]
}
```

### Sanitized SVG
Use for spatial/structural information: geometry, graphs, vectors, maps/schematics, chemical structures, symbols.

Use semantic classes rather than hard-coded colors:

- `svg-main-line`
- `svg-accent-line`
- `svg-muted-line`
- `svg-secondary-line`
- `svg-danger-line`
- `svg-success-line`
- `svg-label`
- `svg-accent-label`
- corresponding secondary/danger/success label/fill variants

No scripts, event handlers, `foreignObject`, remote resources or external links.

## Flashcard schema

```json
{
  "packet_type": "flashcards",
  "dbd_version": "DBD Base 2.0",
  "title": "...",
  "subject": "...",
  "topic": "...",
  "source": "...",
  "cards": [
    {
      "id": "...",
      "topic": "...",
      "subtopic": "...",
      "type": "TERM",
      "front": "...",
      "back": "...",
      "front_stimulus": null,
      "back_stimulus": null,
      "priority": "core",
      "source": "...",
      "tags": ["..."]
    }
  ]
}
```

`front_stimulus` and `back_stimulus` use exactly the same text/table/SVG renderer as question stimuli.

## Question authoring validation

Before export, silently validate the complete set. Do not show private reasoning.

Check when applicable:

- internal consistency;
- solvability;
- sufficient data;
- answer uniqueness;
- correct units and signs;
- correct canonical answer;
- useful answer alternatives/tolerance;
- balanced chemical equations;
- Hess target constructibility;
- diagram labels not clipped or placed on top of strokes;
- table data aligned and readable.

Do not allow a broken generated question to masquerade as learner failure.

## Evidence-aware metadata

Optional `context_label` can establish broad scope without giving away the answer strategy.

A packet may set:

```json
"confidence": "off"
```

when confidence collection would add friction or contaminate a pretest.

## Output

Return valid JSON, or attach a `.json` file for a large packet/deck.

DBD Compact may be used only when the exact lossless encoding is actually produced. Never invent compressed strings.
