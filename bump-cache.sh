#!/bin/sh
# Re-stamp every asset URL in index.html so browsers fetch the new files
# straight after a deploy instead of serving a cached copy.
# Run this before every commit that changes anything in assets/.
python3 - <<'PY'
import re, subprocess, time
stamp = time.strftime('%Y%m%d') + '-' + subprocess.check_output(['git','rev-parse','--short','HEAD']).decode().strip()
h = open('index.html').read()
h = re.sub(r'(<link rel="stylesheet" href="assets/[a-z0-9.]+\.css)(\?v=[^"]*)?(")', lambda m: m.group(1)+'?v='+stamp+m.group(3), h)
h = re.sub(r'(<script src="assets/[a-z0-9.]+\.js)(\?v=[^"]*)?(")',          lambda m: m.group(1)+'?v='+stamp+m.group(3), h)
open('index.html','w').write(h)
print('cache stamp ->', stamp)
PY
