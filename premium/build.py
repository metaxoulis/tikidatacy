"""Bundle the CSS and SVG enhancement script into a self-contained Pages Worker."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent
template=(root/'worker-template.js').read_text()
css=(root/'premium.css').read_text()
icons=(root/'premium-icons.js').read_text()
assert "/* inject_styles */ ''" in template
assert "/* inject_icons */ ''" in template
output=template.replace("/* inject_styles */ ''",json.dumps(css,ensure_ascii=False)).replace("/* inject_icons */ ''",json.dumps(icons,ensure_ascii=False))
(root/'_worker.js').write_text(output)
print('Built premium/_worker.js',len(output),'characters')
