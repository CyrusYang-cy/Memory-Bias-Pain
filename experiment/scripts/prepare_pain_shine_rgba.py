"""Compatibility entry point for the normalized pain pipeline."""
import runpy
from pathlib import Path
if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parents[1] / "stimuli/normalize_pain_faces.py"), run_name="__main__")
