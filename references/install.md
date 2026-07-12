# Install Reference

Use this reference only when the current project cannot already run the recorder.

## Playwright

If Playwright is not installed in the target project, install it outside the repo being recorded:

```bash
mkdir -p /tmp/web-demo-recorder
cd /tmp/web-demo-recorder
npm init -y >/dev/null
npm install playwright@latest
npx playwright install chromium
```

Then run the recorder with:

```bash
NODE_PATH=/tmp/web-demo-recorder/node_modules \
node /path/to/web-demo-recorder/scripts/record-web-operation.cjs ...
```

## Media Tools

The recorder requires `ffmpeg` for MP4 conversion and frame extraction. If `ffmpeg` is missing, produce WebM and say MP4 conversion is blocked.

The voiceover helper requires `ffmpeg` and `ffprobe`. It requires macOS `say` only for generated narration; pre-rendered `audioFile` segments work without `say`.
