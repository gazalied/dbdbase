# DBD Base 2.0 — Generation Protocol

## Institutional boundary

**Subject Chat / teacher / tutor = semantic authority.**
It understands materials, decides what deserves practice, teaches, diagnoses mistakes and authors trustworthy packets.

**DBD Base = execution + evidence.**
It renders, runs, resumes, times, records and exports.

> Score is evidence, not diagnosis.

## Choose the execution surface

### Question Drill
Use for procedures, calculations, application, misconceptions, interpretation, mixed testing and transfer.

### Flashcard Recall
Use for atomic retrieval: terminology, definitions, classifications, named theories, reverse recognition, short causal chains, formulas, symbol meanings and rules.

Do not use Flashcard Recall as a replacement for integrated problem solving.

## Flashcard authoring rules

- One card should test one compact retrievable object.
- Front should be unambiguous without unnecessary prose.
- Back should be the minimal trustworthy answer needed to judge retrieval.
- `type` is descriptive metadata, not a separate UI.
- Do not generate SRS scheduling fields, due dates, ease factors or intervals.
- Human-facing tags are allowed.
- Source should identify the actual basis when available.

Packet:

```json
{
  "packet_type": "flashcards",
  "title": "...",
  "subject": "...",
  "topic": "...",
  "source": "...",
  "cards": []
}
```

Card:

```json
{
  "id": "...",
  "topic": "...",
  "subtopic": "...",
  "type": "TERM",
  "front": "...",
  "back": "...",
  "priority": "core",
  "source": "...",
  "tags": ["..."]
}
```

## Question authoring rules

- Use the existing DBD Base question format.
- Prefer native tables for aligned/comparable data.
- Use sanitized SVG only when spatial/structural information matters.
- Use plain text when that is clearest.
- Audit STEM questions for solvability, sufficient data, answer uniqueness, signs/units and domain-specific consistency.
- For Chemistry, explicitly verify equation balance and Hess constructibility when applicable.
- Full MCQ choices should remain meaningful because Results may be audited upstream.

## Output

Return valid JSON only, or a downloadable JSON file for large packets. DBD Compact may be used only when the exact lossless transport encoding is actually produced.
