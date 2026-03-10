# Image fixtures for diagnostic evaluation

Place sample images here for image-based test cases. Paths in test-case JSON are relative to the project root (e.g. `lib/diagnostics/evaluation/fixtures/dashboard-sample.png`).

**Supported formats:** PNG, JPEG, WebP (see chat API limits).

**Suggested samples:**
- `dashboard-sample.png` — dashboard warning lights / message
- `dtc-scan.jpg` — scan tool or DTC reader screenshot

If a test case references a missing file, the eval runner reports "Image file not found" for that case.
