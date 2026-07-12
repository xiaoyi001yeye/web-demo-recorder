---
name: web-demo-recorder
description: Use when the user asks to record a web app flow, produce an MP4/WebM guided demo, show cursor/click traces, diagnose console/network errors during recording, or add timeline voiceover narration to an operation video.
---

# Web Demo Recorder

Use this skill to create a **guided demo**: a reproducible web operation video with scripted browser steps, visible cursor traces, recording diagnostics, and optional narration.

## Guided Demo Loop

1. **Stabilize the app.** Confirm the target URL loads, required services are running, test users/data exist, and no stale browser auth state will leak into the run. Completion criterion: a fresh browser reaches the starting page and the flow's required data is present.

2. **Choose the artifact folder.** Put scenario scripts, reports, videos, frames, narration scripts, and final media under the user's requested folder; otherwise use a project-local generated/output folder. Completion criterion: every new artifact has an absolute path and no unrelated repo files are touched.

3. **Create a scenario script.** Write a CommonJS file that exports `async function run({ page, recorder })`. Keep app-specific credentials, IDs, route paths, and workflow decisions in this scenario, not in the reusable recorder. Completion criterion: the scenario expresses every visible user step in order and uses recorder helpers for clicks, fills, waits, and scrolls.

4. **Run the bundled recorder.** Use `scripts/record-web-operation.cjs` with the scenario, target base URL, and output directory. Prefer MP4 delivery when the user will share the result. Completion criterion: the recorder exits with status 0 and writes video, frame, and report files.

5. **Inspect the report.** Treat any `console:error`, `pageerror`, `requestfailed`, or HTTP `>=400` event as a failed recording unless the user explicitly accepts it as expected. Fix the app or scenario and rerun. Completion criterion: `summary` is `{}` or every event is explained in the final answer.

6. **Verify the media.** Use `ffprobe` for codec, duration, dimensions, audio streams, and file size; inspect at least one extracted frame or contact sheet when visual quality matters. Completion criterion: the video is nonempty, the requested format is present, and cursor/click/scroll traces are visible when requested.

7. **Add voiceover when requested.** Create a timeline JSON with short narration segments, generate the voiceover, and mix it into the video with `scripts/add-voiceover.cjs`. Completion criterion: the final video has an audio stream, narration segments do not overlap unintentionally, and the narration ends before the video ends.

## Quick Commands

Record a guided demo:

```bash
NODE_PATH=/tmp/web-demo-recorder/node_modules \
node /path/to/web-demo-recorder/scripts/record-web-operation.cjs \
  --scenario /absolute/path/to/scenario.cjs \
  --base-url http://localhost:3000 \
  --out-dir /absolute/path/to/output \
  --name operation-demo \
  --format mp4 \
  --cursor-trail
```

Add voiceover:

```bash
node /path/to/web-demo-recorder/scripts/add-voiceover.cjs \
  --input /absolute/path/to/demo.mp4 \
  --timeline /absolute/path/to/voiceover.json \
  --output /absolute/path/to/demo-voiceover.mp4
```

For setup, scenario details, and voiceover formats, read the references only when needed:

- `references/install.md`
- `references/scenario.md`
- `references/voiceover.md`

## Scenario Contract

Create scenario files like this. Use `recorder.step(name)` before meaningful phases when a scenario does custom Playwright work; diagnostics will include the current step.

```js
exports.run = async ({ page, recorder }) => {
  await recorder.goto('/login', 'login');
  await recorder.fill(page.getByLabel('Username'), 'admin');
  await recorder.fill(page.getByLabel('Password'), process.env.DEMO_PASSWORD);
  await recorder.click(page.locator('button[type="submit"]'));
  await recorder.wait(1200);
  await recorder.goto('/dashboard', 'dashboard');
  await recorder.scrollTo(600);
};
```

Available helpers:

- `recorder.goto(pathOrUrl, stepName)`
- `recorder.click(locator)`
- `recorder.fill(locator, value)`
- `recorder.press(locator, key)`
- `recorder.scrollTo(y)`
- `recorder.moveTo(x, y, options)`
- `recorder.wait(ms)`
- `recorder.step(name)`
- `recorder.installCursor()`

## Voiceover Contract

Create a timeline file with generated narration:

```json
{
  "voice": "Tingting",
  "rate": 220,
  "segments": [
    { "start": 0.4, "text": "Admin view: confirm the project." },
    { "start": 4.5, "text": "Switch to the expert account and open the assigned item." }
  ]
}
```

Or use pre-rendered audio clips for non-macOS environments:

```json
{
  "segments": [
    { "start": 0.4, "audioFile": "/absolute/path/to/segment-01.wav" },
    { "start": 4.5, "audioFile": "/absolute/path/to/segment-02.wav" }
  ]
}
```

Generated narration uses macOS `say`. Timeline segments with `audioFile`, or files found via `--audio-dir`, do not require `say`.

## Quality Rules

- Use authenticated API requests or in-app login; avoid manually embedding bearer tokens in screenshots or logs.
- Clear both stored auth and in-memory auth before switching accounts. In React apps using a custom unauthorized event, dispatch it in the scenario before navigating to the next login page.
- Keep cursor traces visible but not distracting: blue cursor dot, short fading trail, and click pulse are the default.
- Keep narration short and action-aligned. A segment should describe what is happening now, not narrate future steps.
- For mobile web flows, prefer a desktop-sized recording canvas with a centered mobile viewport or app layout. Do not leave accidental blank browser area unless the blank area is the intended frame.
- Never claim the recording is clean until the report and media checks pass.
