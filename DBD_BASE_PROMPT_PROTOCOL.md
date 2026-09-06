# DBD Base Generation Protocol — r3

The authoritative generation doctrine is the prompt produced by **COPY PROMPT** inside DBD Base v1.0 r3.

## r3 renderer contract

- The calculator is always available in the Base quiz UI. JSON no longer controls whether the calculator appears.
- SVG should use semantic classes instead of hard-coded colors:
  - `svg-main-line`
  - `svg-accent-line`
  - `svg-muted-line`
  - `svg-secondary-line`
  - `svg-label`
  - `svg-accent-label`
  - `svg-secondary-label`
  - semantic fill variants when needed.
- Keep angle and degree labels approximately 8–12 px clear of nearby rays/arcs.
- Place degree values above/outside the angle marker rather than directly on a stroke.
- Use generous viewBox margins so labels are not clipped.
- The same SVG packet must remain legible in both Dark and Light modes.
- Explanations stay concise. DBD Base records evidence; it does not perform semantic diagnosis.
