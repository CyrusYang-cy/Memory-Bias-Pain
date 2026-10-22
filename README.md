# Memory-Bias-Pain

Project repository for memory reproduction of painful facial expressions.

## Layout

```text
stimuli/
  Delaware_Pain_Database/  # complete local download; excluded from Git
  filtered_stimuli/        # race/gender subsets; currently empty
  morphed_stimuli/
    rgb/                  # currently empty
    greyscale/            # currently empty
    shined/               # currently empty
experiment/               # snapshot of Memory-Bias-JsPsych pain branch
```

The original dataset folder was moved to this project; it was not deleted. All 1,080 selected official files are present (986,397,537 bytes). Unedited duplicates and older versions are excluded.

## Dataset access

Official database: https://osf.io/2x8r5/ . Access and consent details are documented locally in `stimuli/Delaware_Pain_Database/README.md` and the official read-me. Written lab consent is required for publication/redistribution. Database images and derived images are local-only until permission is confirmed. A GitHub clone therefore does **not** contain the database or the existing experiment's face images. Synthetic shape tutorial images are included.

No filtering or morphing has been performed by this reorganization. Use `rgb` (red/green/blue) for color outputs.

## Experiment

Copied from https://github.com/CyrusYang-cy/Memory-Bias-JsPsych/tree/pain at commit `3deaec3c5a7f97413a25527887f91a55b9f23817` on 2026-10-22. This is a regular directory, not a nested Git repository or submodule. The original repository remains unchanged. Its tracked experiment files and local stimulus files were preserved in the snapshot; secrets, installed dependencies and participant data were not copied.

Run frontend commands from `experiment/frontend` and backend commands from `experiment/backend`; see [experiment instructions](experiment/README.md). The current experiment still reads `experiment/stimuli/study.json` and its existing image directories. The new top-level filtered/morphed directories are preparation folders and are not wired into the experiment yet.

For Railway, select `experiment` as the service root/build context so its Dockerfile's relative paths remain valid. Face assets must be supplied through an authorized deployment process before deployment; a source-only clone is not a complete runnable stimulus package.
