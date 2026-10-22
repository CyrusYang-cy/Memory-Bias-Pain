"""Switch the pain study between original and grayscale SHINE frames."""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = {"original": "pain_faces", "shined": "pain_shine_rgba/images"}


def select(variant: str) -> None:
    path = ROOT / "stimuli/study.json"
    study = json.loads(path.read_text())
    folder = FOLDERS[variant]
    if variant == "shined":
        run = json.loads((ROOT / "stimuli/pain_shine_rgba/run.json").read_text())
        if run.get("status") != "complete":
            raise ValueError("SHINE processing has not completed")
    needed = [
        ROOT / "stimuli" / folder / group / identity / f"{frame}.png"
        for group, identities in study["groups"].items()
        for identity in identities
        for frame in range(study["frames"])
    ]
    missing = [str(p) for p in needed if not p.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing {len(missing)} frames; first: {missing[0]}")
    study["faces_folder"] = folder
    path.write_text(json.dumps(study, indent=2) + "\n")
    print(f"Selected {variant}: {folder} ({len(needed)} frames).")
    print(
        "Restart the backend and reload the experiment before starting a new session."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("variant", choices=FOLDERS)
    select(parser.parse_args().variant)
