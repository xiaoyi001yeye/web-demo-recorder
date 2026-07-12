# Web Demo Recorder

This context describes the language of the `web-demo-recorder` skill. It exists to keep the skill focused on reproducible guided demos rather than generic screen capture.

## Language

**Guided Demo**:
A reproducible web operation video that combines scripted browser steps, visible cursor traces, recording diagnostics, and optional narration. A **Guided Demo** is meant for another person to follow or replay.
_Avoid_: screen recording, capture, walkthrough

**Scenario**:
An app-specific script that performs the visible user flow for a **Guided Demo**. It owns credentials, route paths, IDs, and workflow choices.
_Avoid_: test, script, automation

**Recording Report**:
The diagnostic artifact produced with a **Guided Demo**, containing browser console errors, page errors, failed requests, HTTP errors, and media paths.
_Avoid_: log, result, output

**Voiceover Timeline**:
A list of narration segments placed at absolute times in a **Guided Demo**. Each segment provides text to synthesize or a pre-rendered audio file.
_Avoid_: subtitles, transcript, narration script

## Example Dialogue

Developer: "I need a guided demo of the onboarding flow."

Maintainer: "Create a scenario for the onboarding steps, record it with cursor traces, inspect the recording report, then add a voiceover timeline if the demo needs spoken guidance."
