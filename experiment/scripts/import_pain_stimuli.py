"""Import the corrected 61-frame PNG sequences without changing their pixels."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source",
        type=Path,
        nargs="?",
        default=ROOT.parent / "face-morphing-tutorial/output/pain_faces_morph_61",
    )
    args = parser.parse_args()
    source = args.source.resolve()
    catalog = json.loads((source / "catalog.json").read_text())
    assert catalog["frames"] == 61 and len(catalog["identities"]) == 7
    files = []
    for identity in catalog["identities"]:
        name = identity["id"]
        for frame in range(61):
            src = source / identity["slug"] / "morph" / f"frame_{frame:04d}.png"
            dst = ROOT / "stimuli/pain_faces/Pain" / name / f"{frame}.png"
            if not src.is_file():
                raise FileNotFoundError(src)
            files.append((src, dst))
    records = []
    for src, dst in files:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        digest = hashlib.sha256(src.read_bytes()).hexdigest()
        assert hashlib.sha256(dst.read_bytes()).hexdigest() == digest
        records.append(
            {
                "source": str(src.relative_to(source)),
                "destination": str(dst.relative_to(ROOT / "stimuli")),
                "sha256": digest,
            }
        )
    study_path = ROOT / "stimuli/study.json"
    study = json.loads(study_path.read_text())
    study.update(
        title="Pain expression morphs",
        faces_folder="pain_faces",
        extension=".png",
        frames=61,
        ends=["Sample 01", "Sample 11"],
        studied_frames=[15, 45],
        groups={"Pain": [item["id"] for item in catalog["identities"]]},
    )
    study_path.write_text(json.dumps(study, indent=2) + "\n")
    manifest = {
        "source_dataset": "face-morphing-tutorial/output/pain_faces_morph_61",
        "frames_per_identity": 61,
        "anchor_frames": list(range(0, 61, 6)),
        "pixel_transform": "none; byte-identical PNG copies",
        "identities": [
            {"id": i["id"], "outline_mode": i["resolvedOutlineMode"]}
            for i in catalog["identities"]
        ],
        "excluded_incomplete_identities": catalog["skipped"],
        "files": records,
    }
    (ROOT / "stimuli/pain_manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    print(f"Imported and SHA-256 verified {len(records)} PNGs.")


if __name__ == "__main__":
    main()
