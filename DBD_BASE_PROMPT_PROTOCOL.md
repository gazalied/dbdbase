# DBD Base 1.5 — Generation Protocol

The authoritative live generation instruction is produced by the **COPY PROMPT** button inside DBD Base 1.5.

Core boundary:

> **Subject Chat understands and generates. DBD Base executes and records.**

Core evidence rule:

> **Score is evidence, not diagnosis.**

## Packet format

DBD Base 1.5 accepts ordinary JSON using DBD Base Packet v1.

Supported question types:

- `mcq`
- `multi_select`
- `numeric`
- `short`
- `essay`

Supported stimulus types:

- `text`
- `table`
- `svg`

Important authoring rules:

- MCQ choice values contain answer text only; Base renders A/B/C labels itself.
- Multi-select answers are arrays of choice keys, e.g. `["A", "C"]`.
- Use tables for aligned/comparable data; do not fake tables with SVG.
- Use SVG only when spatial/structural relationships matter.
- Use human-facing concept/skill tags.
- Distinguish target tags from optional `prerequisites` context when useful.
- For numeric answers, an explicit leading `+` is normally unnecessary.
- Audit answer uniqueness, units, signs, and domain validity before exporting.
- In Chemistry specifically, verify equation balance and Hess-law constructibility before export.
- “Mentioned” does not automatically mean “taught”.

## DBD Compact v1

Optional packet transport:

```text
DBDC1.GZ.<sha256-hex>.<base64url-payload>
```

The complete packet must be serialized as minified UTF-8 JSON, SHA-256 hashed, losslessly GZIP-compressed, then Base64URL encoded without `=` padding.

Never fabricate compressed text. If exact compression tooling is unavailable, provide ordinary JSON or a downloadable JSON file.

DBD Compact is not the normal Vault backup workflow in 1.5.
