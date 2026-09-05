# DBD Base v1.0 — Prompt / Renderer Protocol

DBD Base is a local-first drill renderer and evidence recorder.

Core workflow:

```text
COPY PROMPT
→ subject ChatGPT
→ JSON packet
→ IMPORT PACKAGE
→ drill
→ factual results/history
```

## Renderer capabilities

DBD Base v1.0 supports:

- MCQ
- short answer
- numeric answer
- self-check
- essay
- text/context/quote stimulus
- sanitized inline SVG
- optional built-in calculator
- flexible answer matching with accepted answers, tolerance and optional regex

### Numeric input

Use `type: "numeric"` for fundamentally numeric answers.

Optional:

```json
"numeric_mode": "integer"
```

or:

```json
"numeric_mode": "decimal"
```

DBD Base requests a number-oriented mobile keyboard.

### SVG

Use:

```json
"stimulus": {
  "type": "svg",
  "title": "Human-readable diagram title",
  "svg": "<svg viewBox=\"0 0 420 280\">...</svg>"
}
```

Keep all important geometry and labels inside the `viewBox`. DBD Base strips unsafe SVG features and makes diagrams pointer-inert so they cannot steal answer hitboxes.

Supported technical primitives include lines, paths, circles, ellipses, rectangles, polygons, polylines, text, groups, marker arrowheads, gradients, and clipping paths.

### Answer matching

For open responses, prefer:

1. numeric comparison / tolerance when fundamentally numeric;
2. canonical answer;
3. `accepted_answers`;
4. `answer_regex` only when safe and useful.

Equivalent mathematical forms should not become false negatives merely because of units or predictable wording.

## Product boundary

DBD Base does not perform semantic diagnosis and does not decide long-term study priority.

It renders prepared questions and records evidence.
