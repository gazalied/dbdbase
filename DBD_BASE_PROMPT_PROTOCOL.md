# DBD Base Generation Protocol — r5

Use the live **COPY PROMPT** inside DBD Base v1.0 r5 as the authoritative generation doctrine.

R5 adds deliberate representation selection (text/table/SVG), packet-wide QA, calculator trail evidence, and optional DBD Compact v1 delivery.

## DBD Compact v1

`DBDC1.GZ.<sha256-hex>.<base64url-payload>`

The complete packet is serialized as minified UTF-8 JSON, SHA-256 hashed, losslessly GZIP-compressed, then Base64URL encoded without padding.

Never fabricate a compact payload. If exact compression tooling is unavailable, return ordinary valid JSON or a downloadable JSON file.
