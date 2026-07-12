# Web Demo Recorder

`web-demo-recorder` is a Codex skill for producing guided web frontend demos: scripted browser recordings with cursor traces, console/network diagnostics, MP4 export, and optional timeline-based voiceover.

## Files

- `SKILL.md` — skill entry point
- `scripts/record-web-operation.cjs` — Playwright recorder
- `scripts/add-voiceover.cjs` — timeline voiceover mixer
- `references/` — setup, scenario, and voiceover details
- `CONTEXT.md` — project language

## Quick Start

Install Playwright outside the project you are recording:

```bash
mkdir -p /tmp/web-demo-recorder
cd /tmp/web-demo-recorder
npm init -y >/dev/null
npm install playwright@latest
npx playwright install chromium
```

Record:

```bash
NODE_PATH=/tmp/web-demo-recorder/node_modules \
node ./scripts/record-web-operation.cjs \
  --scenario /absolute/path/to/scenario.cjs \
  --base-url http://localhost:3000 \
  --out-dir /absolute/path/to/output \
  --name operation-demo \
  --format mp4 \
  --cursor-trail
```

Add voiceover:

```bash
node ./scripts/add-voiceover.cjs \
  --input /absolute/path/to/operation-demo.mp4 \
  --timeline /absolute/path/to/voiceover.json \
  --output /absolute/path/to/operation-demo-voiceover.mp4
```

Generated narration uses macOS `say`. On other systems, provide pre-rendered audio clips with `segments[].audioFile` or `--audio-dir`.
