# Local preview

Node.js 22+ and Python 3:

```bash
node --check model.js
node test_model.js
python bundle.py
node --check _worker.js
```

Browser tests require Playwright/Chromium.

The bundled Worker needs a D1 binding named `DB` to the *test-only* database `tiki_data_lab`. Do **not** deploy it directly to production. The already deployed QA v0.3 service is separate from this v0.2 bundle; integration and parity testing are needed before redeployment.

No secrets belong in source control.
