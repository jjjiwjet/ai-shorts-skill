---
name: remotion-flow-shorts
description: Make Korean YouTube Shorts (9:16) end to end: write a fact-checked script, generate scene images in Google Flow through Claude in Chrome, narrate with a local Voicebox voice (or ElevenLabs), and render with Remotion in a 16-bit pixel-art or comic theme. Use when the user asks for 숏폼/쇼츠/shorts videos, more videos "like before", a batch of topic videos, or a Remotion + Flow + Voicebox pipeline.
---

# Remotion + Google Flow + Voicebox shorts

One project renders many shorts. Each video is a JSON file in `data/videos/<id>.json`; its images live in `public/<id>/assets/`, its narration in `public/<id>/audio/`, and `npm run render -- <id>` writes `out/<id>.mp4`.

Files in this skill:
- `template/` — the Remotion project (copy it once per workspace)
- `tools/receiver.py` — localhost server the Flow tab pushes images into
- `tools/flow-helpers.js` — page helpers for the Flow tab
- `tools/prompts.py` — prints the Flow prompt for every scene of a video

## 0. Project setup (once)

If the working directory has no `data/videos/`, copy the template in and install:

```bash
cp -R ~/.claude/skills/remotion-flow-shorts/template/. <project>/
cd <project> && npm install   # postinstall copies the Galmuri pixel font into public/fonts
```

`example-pixel.json` and `example-comic.json` show both themes; delete them once real videos exist (their assets are not shipped).

## 1. Topics and scripts

Pick topics the user asked for (default 3 per batch). Write one `data/videos/<id>.json` per video:

```json
{
  "id": "kebab-id", "theme": "pixel", "title": "상단 고정 제목 (짧게)",
  "style": "<shared image style suffix, copy from example-pixel.json>",
  "scenes": [
    {"id": "x01", "hook": ["첫 줄", "둘째 줄"], "narration": "...", "highlight": ["강조어"], "motion": "zoomIn", "prompt": "English scene description"},
    {"id": "x02", "narration": "...", "highlight": ["..."], "motion": "panRight", "prompt": "..."}
  ]
}
```

- Scene ids: one lowercase letter unique to the video + two digits (`c01`). The receiver only accepts that shape.
- 6–7 scenes, one or two short sentences each, about 40–50 s total. Scene 1 has `hook` (two big lines, no caption box).
- `highlight` words must appear verbatim in `narration`; they turn yellow in captions.
- `motion`: `zoomIn | zoomOut | panRight | panLeft`.
- `theme`: `pixel` (Galmuri font, RPG dialog captions with typewriter, stepped motion, scanlines) or `comic` (Black Han Sans, stroked captions).
- Facts: only use claims you are confident are true and attributable (study, person, year). No invented statistics. Round numbers the way the source does. If unsure, rephrase to something you can stand behind.
- Prompts: English, concrete subject + setting + mood, no text in image. Reusing a recurring character (e.g. "a retro robot") keeps a series consistent. Avoid real people's likeness; describe roles instead.

Run `npm run prepare-assets` and `npx tsc -p .` to validate.

## 2. Narration (Voicebox) — start it in the background early

Voicebox runs locally at `http://localhost:17493` (check `/health`; if it does not answer, ask the user to restart the Voicebox app).

```bash
curl -s localhost:17493/profiles   # list profiles: name, voice_type, sample_count, language
python3 scripts/tts_voicebox.py <video-id> --profile <name> --engine <engine>
```

- A cloned voice has `sample_count > 0`; use `--engine qwen`.
- A `preset` profile uses its `preset_engine`. Kokoro presets cannot speak Korean (they produce garbage like "Top Top Top"). For a Korean test voice, create a preset profile on `qwen_custom_voice` / `Sohee`:
  `curl -X POST localhost:17493/profiles -H 'Content-Type: application/json' -d '{"name":"sample-sohee","language":"ko","voice_type":"preset","preset_engine":"qwen_custom_voice","preset_voice_id":"Sohee","default_engine":"qwen_custom_voice"}'`
  then `--profile sample-sohee --engine qwen_custom_voice`.
- Spot-check pronunciation: `curl -s -F file=@public/<id>/audio/<scene>.wav -F language=ko localhost:17493/transcribe`. Regenerate a bad scene with `--only <scene> --seed <n>`.
- ElevenLabs alternative: `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`, then `npm run tts:eleven -- <video-id>`.

Scene lengths follow the real audio; until audio exists the timeline estimates from text length.

## 3. Images (Google Flow via Claude in Chrome)

Needs the Claude in Chrome tools (user runs `/chrome` if they are missing) and the user logged in to Flow. Image generation spends the user's Flow credits — confirm before the first batch in a conversation.

1. Start the receiver in the background: `python3 -I ~/.claude/skills/remotion-flow-shorts/tools/receiver.py <project>`.
   Restart it after adding new video JSON files (it reads the id list at startup).
2. Open `https://flow.google.com/` in a new tab, open the user's existing project or "새 프로젝트". In the agent panel settings (sliders icon next to the prompt box) set image ratio **9:16** and count **x1**, then save.
3. Start a fresh agent chat session (pencil icon at the top of the agent panel). A long session drifts: the agent starts inventing extra images.
4. Run `tools/flow-helpers.js` in the tab with `javascript_tool`. The first push from the page triggers Chrome's **local network access** prompt; the user must click Allow, otherwise fetches to 127.0.0.1 hang.
5. Per scene, take the line from `python3 tools/prompts.py <project> <video-id>` and run:
   - `browser_batch`: click the prompt box → type the prompt → `javascript_tool`: `const r=await window.__ready(35000); window.__seen=new Set(window.__keys()); r` → key `Return` → wait 10 s twice.
   - Then `javascript_tool`: `await window.__waitPush('<video-id>/<scene>.jpg', 42000)`; repeat once or twice on `timeout` (an image takes about 60–90 s).

Pitfalls seen in practice:
- Keep each `browser_batch` under ~60 s and each `javascript_tool` under 45 s, or the call times out (the browser keeps going; check what was saved before retrying).
- `__ready` only means "idle" after text is typed: an empty box always disables the send button. If it returns `not-ready`, the agent is still busy; wait and retry instead of clicking the button (while busy it is the stop button).
- If the prompt box comes back empty without a new user message in the chat, the text was lost; click the box and type again.
- Saving through Chrome downloads into `~/Downloads` can fail with `Operation not permitted` (macOS privacy); the receiver avoids that.
- Flow draws a cream border on some styles and a small Gemini sparkle mark bottom-right. The composition zooms ≥1.1× which crops the border; the mark stays.

After a batch, verify every image matches its scene before rendering: `sips -Z 240 <img> --out <scratch>/<name>` and read the thumbnails. Regenerate mismatches.

## 4. Render and hand over

```bash
npm run render -- <id> [<id> ...]   # out/<id>.mp4
open out/<id>.mp4
```

Render a video as soon as its images and audio are ready instead of waiting for the whole batch, and open it for the user. Close the Flow tab and stop the receiver when done.

Report per video: title, file path, length, narration voice used, and anything unverified (e.g. pronunciation not spot-checked, images regenerated).
