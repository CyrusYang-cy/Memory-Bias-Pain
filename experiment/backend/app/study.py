"""The stimulus set, described by `stimuli/study.json`.

Everything that is specific to one set of faces lives in the `stimuli/` folder: the images
and this file. To run the study with different faces (e.g. painful vs. non-painful instead
of dominant vs. submissive), replace the images and edit study.json; no code changes.

    {
      "title": "...",               # free text, for your own reference
      "faces_folder": "faces",      # stimuli/<faces_folder>/<group>/<identity>/<frame><ext>
      "extension": ".png",
      "frames": 61,                 # frames per identity: 0 … frames-1
      "ends": ["Sad", "Happy"],     # what frame 0 and the last frame look like
      "studied_frames": [15, 45],   # studied faces are drawn from this range (inclusive)
      "groups": {"Dominant": ["WM_475", …], "Submissive": […]},
      "practice": {"folder": "examples/example_CFD_identities", "frames": 61}
    }

Participants reproduce each face on the full range 0 … frames-1.
"""

import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, model_validator


class Practice(BaseModel):
    folder: str
    frames: int = Field(ge=2)


class Study(BaseModel):
    title: str = ""
    faces_folder: str = "faces"
    extension: str = ".png"
    frames: int = Field(ge=2)
    ends: tuple[str, str] = ("Start", "End")
    studied_frames: tuple[int, int]
    groups: dict[str, list[str]] = Field(min_length=1)
    practice: Practice | None = None

    @model_validator(mode="after")
    def _check(self) -> "Study":
        low, high = self.studied_frames
        if not 0 <= low <= high < self.frames:
            raise ValueError(
                f"studied_frames {list(self.studied_frames)} must lie in 0…{self.frames - 1}"
            )
        for group, names in self.groups.items():
            if not names:
                raise ValueError(f"group {group!r} has no identities")
            if len(set(names)) != len(names):
                raise ValueError(f"group {group!r} lists an identity twice")
        if not self.extension.startswith("."):
            raise ValueError('extension must start with "." (e.g. ".png")')
        return self

    @property
    def target_frames(self) -> range:
        """Frames a studied face may be drawn from."""
        low, high = self.studied_frames
        return range(low, high + 1)

    def missing_images(self, stimuli_dir: Path) -> list[str]:
        """Image files the study needs but that don't exist (relative to stimuli/)."""
        needed = [
            f"{self.faces_folder}/{group}/{identity}/{frame}{self.extension}"
            for group, names in self.groups.items()
            for identity in names
            for frame in range(self.frames)
        ]
        if self.practice:
            needed += [
                f"{self.practice.folder}/{frame}{self.extension}"
                for frame in range(self.practice.frames)
            ]
        return [path for path in needed if not (stimuli_dir / path).is_file()]


@lru_cache
def load_study(stimuli_dir: Path) -> Study:
    path = stimuli_dir / "study.json"
    if not path.is_file():
        raise FileNotFoundError(f"{path} not found; see README, 'Use your own faces'")
    return Study.model_validate(json.loads(path.read_text()))
