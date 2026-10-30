"""Rebuild embedded assets without silently changing the reviewed source files."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
worker = ROOT / 'frontend/worker.js'
text = worker.read_text()
crlf = '\r\n' in worker.read_bytes().decode()
assets = {
    'JS': 'app.js', 'HOME_V23_JS': 'home-v23.js', 'HOME_V23_CSS': 'home-v23.css',
    'HTML_HOME': 'home-v23.html', 'HTML_PREDICTIONS': 'predictions.html',
    'JS_DATA': 'data.js', 'CSS_DATA': 'data.css', 'HTML_DATA': 'data.html',
    'MOBILE_UI_JS': 'mobile-ui.js', 'MOBILE_UI_CSS': 'mobile-ui.css',
    'BRAND': 'brand.svg', 'FAVICON': 'favicon-new.svg',
    'LEGAL_CSS': 'legal.css', 'LEGAL_THEME_JS': 'legal-theme.js',
    **{'LEGAL_' + page.upper(): page + '.html' for page in ['about', 'privacy', 'terms', 'cookies', 'contact']},
}
for key, filename in assets.items():
    value = (ROOT / 'frontend-v13' / filename).read_text()
    pattern = r'^const ' + key + r'=.*;$'
    text, count = re.subn(pattern, lambda _: 'const ' + key + '=' + json.dumps(value, ensure_ascii=False) + ';', text, flags=re.M)
    if count != 1:
        raise RuntimeError('Expected exactly one bundle for ' + key)
module = (ROOT / 'frontend/forecast-integrity.mjs').read_text().replace('export function ', 'function ')
text, count = re.subn(r'/\* forecast-integrity:start \*/.*?/\* forecast-integrity:end \*/', lambda _: '/* forecast-integrity:start */\n' + module + '\n/* forecast-integrity:end */', text, flags=re.S)
if count != 1:
    raise RuntimeError('Missing forecast-integrity module markers')
module = (ROOT / 'frontend/football-trial.mjs').read_text().replace('export ', '')
text, count = re.subn(r'/\* football-trial:start \*/.*?/\* football-trial:end \*/', lambda _: '/* football-trial:start */\n' + module + '\n/* football-trial:end */', text, flags=re.S)
if count != 1:
    raise RuntimeError('Missing football-trial module markers')
module = (ROOT / 'frontend/recent-lineup-evidence.mjs').read_text() + '\n' + (ROOT / 'frontend/football-primary.mjs').read_text()
module = re.sub(r'^import .*?;\n', '', module, flags=re.M).replace('export ', '')
text, count = re.subn(r'/\* football-primary:start \*/.*?/\* football-primary:end \*/', lambda _: '/* football-primary:start */\n' + module + '\n/* football-primary:end */', text, flags=re.S)
if count != 1:
    raise RuntimeError('Missing football-primary markers')
module = (ROOT / 'frontend/sportmonks-archive.mjs').read_text().replace('export ', '')
text, count = re.subn(r'/\* sportmonks-archive:start \*/.*?/\* sportmonks-archive:end \*/', lambda _: '/* sportmonks-archive:start */\n' + module + '\n/* sportmonks-archive:end */', text, flags=re.S)
if count != 1:
    raise RuntimeError('Missing sportmonks-archive markers')
module = (ROOT / 'frontend/sportmonks-assets.mjs').read_text().replace('export ', '')
text, count = re.subn(r'/\* sportmonks-assets:start \*/.*?/\* sportmonks-assets:end \*/', lambda _: '/* sportmonks-assets:start */\n' + module + '\n/* sportmonks-assets:end */', text, flags=re.S)
if count != 1:
    raise RuntimeError('Missing sportmonks-assets markers')
# Keep the Worker's existing line endings so diffs stay focused on the changes.
text = text.replace('\r\n', '\n')
if crlf:
    text = text.replace('\n', '\r\n')
worker.write_bytes(text.encode())
