"""Generate per-scene narration with a local Voicebox voice profile.

Usage: python3 scripts/tts_voicebox.py <video-id> --profile <name-or-id> [--engine qwen] [--only s01,s02]
"""
import argparse
import json
import shutil
import sys
import time
import urllib.request
from pathlib import Path

API = "http://localhost:17493"
ROOT = Path(__file__).resolve().parent.parent


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        raw = r.read()
        return json.loads(raw) if r.headers.get_content_type() == "application/json" else raw


def resolve_profile(key):
    profiles = call("GET", "/profiles")
    for p in profiles:
        if key in (p["id"], p["name"]):
            return p
    names = ", ".join(f'{p["name"]} ({p["voice_type"]}, samples={p["sample_count"]})' for p in profiles)
    sys.exit(f"profile '{key}' not found. available: {names}")


def wait(gen):
    # /generate/{id}/status is an event stream, so poll the history record instead.
    while gen.get("status") not in ("completed", "failed", "error"):
        time.sleep(1.5)
        gen = call("GET", f"/history/{gen['id']}")
    if gen["status"] != "completed":
        sys.exit(f"generation {gen['id']} failed: {gen.get('error')}")
    return gen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--profile", required=True)
    ap.add_argument("--engine", default="qwen")
    ap.add_argument("--instruct", default="차분하지만 호기심을 자극하는 다큐멘터리 내레이션 톤")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    profile = resolve_profile(args.profile)
    scenes = json.loads((ROOT / "data" / "videos" / f"{args.video}.json").read_text())["scenes"]
    only = set(filter(None, args.only.split(",")))
    out = ROOT / "public" / args.video / "audio"
    out.mkdir(parents=True, exist_ok=True)
    durations_file = out / "durations.json"
    durations = json.loads(durations_file.read_text()) if durations_file.exists() else {}

    for s in scenes:
        if only and s["id"] not in only:
            continue
        print(f"[{s['id']}] {s['narration']}")
        gen = call("POST", "/generate", {
            "profile_id": profile["id"],
            "text": s["narration"],
            "language": "ko",
            "engine": args.engine,
            "seed": args.seed,
            "instruct": args.instruct or None,
        })
        gen = wait(gen)
        dest = out / f"{s['id']}.wav"
        src = Path(gen["audio_path"]) if gen.get("audio_path") else None
        if src and src.exists():
            shutil.copy(src, dest)
        else:
            dest.write_bytes(call("GET", f"/history/{gen['id']}/export-audio"))
        durations[s["id"]] = gen["duration"]
        print(f"   -> {dest.relative_to(ROOT)} ({gen['duration']:.2f}s)")
        durations_file.write_text(json.dumps(durations, indent=2) + "\n")


if __name__ == "__main__":
    main()
