"""Generate per-scene narration with ElevenLabs (cloned voice).

Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in the environment.
Usage: python3 scripts/tts_elevenlabs.py <video-id> [--model eleven_multilingual_v2] [--only s01,s02]
"""
import argparse
import json
import os
import sys
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--model", default="eleven_multilingual_v2")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    voice = os.environ.get("ELEVENLABS_VOICE_ID")
    if not key or not voice:
        sys.exit("set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID")

    scenes = json.loads((ROOT / "data" / "videos" / f"{args.video}.json").read_text())["scenes"]
    only = set(filter(None, args.only.split(",")))
    out = ROOT / "public" / args.video / "audio"
    out.mkdir(parents=True, exist_ok=True)

    for s in scenes:
        if only and s["id"] not in only:
            continue
        print(f"[{s['id']}] {s['narration']}")
        body = json.dumps({
            "text": s["narration"],
            "model_id": args.model,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.85, "style": 0.3},
        }).encode()
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_44100",
            data=body,
            headers={"xi-api-key": key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            pcm = r.read()
        # Wrap raw 16-bit mono PCM in a WAV header so build-manifest can read its duration.
        dest = out / f"{s['id']}.wav"
        with wave.open(str(dest), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(44100)
            w.writeframes(pcm)
        print(f"   -> {dest.relative_to(ROOT)} ({len(pcm) / 88200:.2f}s)")
    # Durations are read from the WAV headers.
    (out / "durations.json").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
