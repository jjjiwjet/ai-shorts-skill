"""Prints the Flow prompt for every scene of a video, one per line: <scene-id> | <prompt>.

Usage: python3 prompts.py <project-dir> <video-id>
"""
import json
import sys
from pathlib import Path

project, video = Path(sys.argv[1]), sys.argv[2]
v = json.loads((project / "data" / "videos" / f"{video}.json").read_text())
for s in v["scenes"]:
    print(f"{s['id']} | Generate exactly one 9:16 image with this prompt, and nothing else afterwards: {s['prompt']}. {v['style']}")
