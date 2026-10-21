# remotion-flow-shorts

A Claude Code skill that makes Korean YouTube Shorts end to end:

- **Script**: fact-checked narration split into 6–7 scenes per video
- **Images**: generated in [Google Flow](https://flow.google.com) through Claude in Chrome, pushed straight into the project
- **Voice**: local [Voicebox](https://voicebox.sh) (cloned or preset voice), or ElevenLabs
- **Video**: [Remotion](https://www.remotion.dev), 1080×1920, two themes
  - `pixel`: Galmuri pixel font, RPG dialog-box captions with a typewriter reveal, stepped motion, scanlines
  - `comic`: Black Han Sans with stroked captions and pop-in animation

## Install

```bash
git clone https://github.com/jjjiwjet/ai-shorts-skill ~/.claude/skills/remotion-flow-shorts
```

Then ask Claude Code for something like "AI 주제로 픽셀아트 쇼츠 3개 만들어줘".

## Requirements

- Node 18+, Python 3
- Claude in Chrome extension, logged in to Google Flow (image generation uses your Flow credits)
- Voicebox running locally (`http://localhost:17493`), or an ElevenLabs API key and voice id

## Layout

```
SKILL.md                 workflow Claude follows
template/                Remotion project copied into your workspace
  data/videos/*.json     one file per video (script, highlights, image prompts)
  src/Short.tsx          the composition (both themes)
  scripts/               manifest builder, renderer, Voicebox / ElevenLabs TTS
tools/receiver.py        localhost receiver the Flow tab pushes images into
tools/flow-helpers.js    helpers injected into the Flow tab
tools/prompts.py         prints Flow prompts for a video
```

Fonts: Galmuri (OFL-1.1) is installed from npm; Black Han Sans loads from Google Fonts.
