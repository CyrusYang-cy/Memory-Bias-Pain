# Memory-Bias pain face reproduction experiment (1D)

Participants briefly see a face, then reproduce it from memory by turning a circular slider
that morphs the face along the ordered pain-expression samples 01 → 11. Frontend: TypeScript +
[jsPsych 8](https://www.jspsych.org/) + Vite. Backend: FastAPI + SQLModel (SQLite locally,
Postgres on Railway). The 2D version (square pad, four emotions) is on the `2D-continuum`
branch; both share the same setup, modes and tools.

Everything specific to one set of faces lives in `stimuli/`: the images and
`stimuli/study.json`. To run the same experiment with other faces, see
[Use your own faces](#use-your-own-faces).

## Quick start

Requirements: Node ≥ 22.12 with **npm ≥ 11** (`npm i -g npm@11`), and
[uv](https://docs.astral.sh/uv/) for Python. Run every command from the repository folder
(the one containing this README).

One-time setup:

```bash
cp .env.example .env                     # then edit; see "Server settings"
cd frontend && npm install && cd ..
cd backend && uv sync && cd ..
```

Start the backend (always needed, except with `?offline=1`):

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000
```

For development, also start the frontend dev server:

```bash
cd frontend && npm run dev
```

Which address to open depends on the mode; see the next section. Restart the backend after
changing `.env` or `stimuli/study.json`.

## Three ways to run

| | **debug** | **pilot** | **experiment** |
| --- | --- | --- | --- |
| For | developing and checking | piloting yourself / with lab members | real participants |
| Open | <http://localhost:5173/exp/> (dev server; debug is its default) | `…/exp/?mode=pilot` on the dev server or the deployed site | the deployed site, or locally the production build at <http://localhost:8000/exp/> (needs `npm run build` first) |
| Phases | fullscreen, task, results (change with `?phases=` / `?skip=`) | intro, task, results | intro, task, outro |
| Under the slider | nothing; the debug **Reveal** button shows frame numbers and the answer | identity only, e.g. `WM_300`, while viewing and reproducing | nothing |
| Debug bar and debug parameters | yes | only `?trials=` (shorter pilots) | no |
| Data saved as `condition` | `debug` (not saved with `?save=0`) | `pilot` | `Intermixed` |
| End of session | data shown on screen | "Pilot session saved" | redirect to Prolific/SONA, or a completion code |

Switch mode with `?mode=debug`, `?mode=pilot` or `?mode=experiment`. Without it, the dev
server runs debug and the deployed site runs experiment. Debug mode is refused on a deployed
site unless the server has `DEBUG_MODE=1`, so participants (whose links never include
`mode`) always get experiment mode. Each mode balances frames separately (see
[Sampling and balancing](#sampling-and-balancing)), so pilots and test runs never affect the real study.

The phases, grouped into three sections:

| Section | Phase | What happens |
| --- | --- | --- |
| intro | `consent` | consent form; declining → google.com |
| intro | `fullscreen` | switch to full screen (and back at the end) |
| intro | `attrition` | type "I will answer open-ended questions." |
| intro | `instructions` | instruction pages + practice slider with an example face morph (not a study identity) |
| task | `task` | memory trials: countdown 2 s → face 1 s → blank 1.5 s → reproduce, no time limit |
| task | `results` | memory-bias report for the trials just done (pilot and debug only) |
| outro | `survey` | open questions and demographics |
| outro | `debriefing` | debriefing statement |

## Common recipes

Local recipes use the frontend dev server. Start it from the repository root:

```bash
cd frontend
npm run dev
```

**Offline:** add `offline=1`; no backend is needed and no participant data is saved.
Offline mode is available only on the dev server and reads the selected stimulus set
from `stimuli/study.json`. It creates random trial assignments without server balancing.
Other experiment recipes require the backend as well. The URLs below use the default
port 5173; substitute the port printed by Vite (for example, 5182).

| Goal | URL |
| --- | --- |
| Offline: all seven trials + results | <http://localhost:5173/exp/?offline=1&phases=task,results> |
| Offline: practice instructions + three trials + results | <http://localhost:5173/exp/?offline=1&phases=instructions,task,results&trials=3> |
| Offline: one trial only | <http://localhost:5173/exp/?offline=1&phases=task&trials=1> |
| Every phase, only 2 trials | <http://localhost:5173/exp/?phases=intro,task,results,outro&trials=2> |
| A few trials + results | <http://localhost:5173/exp/?trials=10> |
| Same, without saving anything | <http://localhost:5173/exp/?trials=10&save=0> |
| Practice page + trials, no consent | <http://localhost:5173/exp/?phases=instructions,task,results&save=0> |
| Proofread consent, attrition, instructions | <http://localhost:5173/exp/?phases=intro&save=0> |
| Proofread survey and debriefing | <http://localhost:5173/exp/?phases=outro&save=0> |
| Watch a session run by itself | <http://localhost:5173/exp/?simulate=visual&trials=5&save=0> |
| Results report from a full simulated session | <http://localhost:5173/exp/?simulate=data-only&save=0> |
| Replay a participant's trial order | `http://localhost:5173/exp/?seed=<their seed>&save=0` |
| A pilot session | <http://localhost:5173/exp/?mode=pilot> |
| The participant view | <http://localhost:5173/exp/?mode=experiment> |
| Draw the results report from pasted data | <http://localhost:5173/exp/report.html> |
| A pilot on the deployed site | `https://<app>/exp/?mode=pilot&workerId=pilot01` |
| A short pilot (3 trials) | `https://<app>/exp/?mode=pilot&workerId=pilot02&trials=3` |

`/` and `/exp` redirect to `/exp/` and keep all URL parameters.

## URL parameters

### Participant ID

Recruitment platforms add these to the link. The first one present decides the platform:

| Platform | Parameters | Link to give the platform |
| --- | --- | --- |
| Prolific | `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` | `/exp/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}` |
| SONA | `sona_id` | `/exp/?sona_id=%SURVEY_CODE%` |
| CloudResearch Connect | `participantId`, `projectId`, `assignmentId` | `/exp/?participantId=…&projectId=…&assignmentId=…` |
| MTurk | `workerId`, `hitId`, `assignmentId` | `/exp/?workerId=…&hitId=…&assignmentId=…` |

- The ID is saved as `worker_id`.
- **End of session (experiment mode):** SONA participants go to `REDIRECT_URL` +
  `experiment_id=…&credit_token=…&survey_code=<sona_id>`; everyone else to `REDIRECT_URL`;
  without `REDIRECT_URL` a completion code is shown.
- **Repeat visits:** the same ID with an unfinished session (e.g. a refresh) starts again
  from the beginning and `refresh_count` goes up; a finished ID is blocked ("you've
  participated in this study before").
- **No ID:** the dev server makes up a new one (`dev-…`) on every load; the deployed site
  shows an error. So to test on the deployed site, use a new ID each time.

### Debug parameters

Only in debug mode (ignored otherwise). Combine with `&`; a mistyped value shows an error
explaining what's wrong.

Used most:

| Parameter | Example | Effect |
| --- | --- | --- |
| `trials` | `?trials=10` | at most 10 trials; this seven-identity study still runs seven |
| `save` | `?save=0` | save nothing; show the data and report at the end |
| `phases` | `?phases=intro,task` | run exactly these phases; sections `intro` and `outro` work as names |
| `skip` | `?skip=fullscreen` | leave phases out of the set that would run |
| `labels` | `?labels=0` | remove the Reveal button (see exactly what participants see) |

For automated and repeatable testing:

| Parameter | Example | Effect |
| --- | --- | --- |
| `simulate` | `?simulate=visual` | jsPsych clicks through by itself in real time; `data-only` does it instantly without drawing |
| `seed` | `?seed=abc` | same trial order, slider angles and start frames every time (the studied frames come from the server's plan) |
| `offline` | `?offline=1` | no backend: random plan from `stimuli/study.json` (same no-repeat rule, no balancing), nothing saved (dev server only) |

Notes:

- Simulated sessions are saved like real ones unless you add `save=0`.
- Every session records its `seed`, so `?seed=<their seed>` replays a participant's
  trial order and slider angles.
- Phases that don't run don't send their progress status (e.g. no
  `working_finished_consent` without consent).
- **Reveal button:** during the response, "Reveal" under the slider shows the frame
  number at every 30° of the ring, the identity, the current frame, the answer and the
  shift with its direction, plus a fixed line from frame 0 to the last frame (studied
  range shaded, answer in orange, current face in blue). Every trial starts hidden;
  nothing is shown while the face is studied.

### What reaches the database

| Situation | Participant row (`condition`) | Progress statuses | Trial data | End of session |
| --- | --- | --- | --- | --- |
| experiment | created (`Intermixed`) | updated | saved; status → `complete` | redirect or completion code |
| pilot | created (`pilot`) | updated | saved | "Pilot session saved" |
| debug | created (`debug`) | updated | saved | data shown on screen |
| debug + `?save=0` | created (`debug`, stays `started`) | not sent | not saved | data shown on screen |
| Server `DEBUG_MODE=1` | created | updated | not saved | data shown on screen |
| `?offline=1` | none | none | none | data shown on screen |

### Debugging tools

In debug mode a red bar in the bottom-right corner shows the phase, trial, seed and active
options. In the browser console, experiment log lines start with `[exp]`, and
`window.__exp` holds `jsPsych`, `ctx` (session settings), `timeline` and, at the end, `data`.

## Server settings

Set in `.env` locally, or in Railway → Variables. Defaults are in `backend/app/config.py`;
a template is in `.env.example`.

| Variable | Meaning |
| --- | --- |
| `NUM_IDENTITIES` | identities per group (the first N listed in `stimuli/study.json`); a session has groups × N trials. 7 (default) = all seven pain identities; it can't exceed the number of studied frames |
| `ABANDON_AFTER_MINUTES` | an unfinished session stops counting for balancing after this long (120) |
| `REDIRECT_URL`, `EXPERIMENT_ID`, `CREDIT_TOKEN` | end-of-session redirect (see Participant ID) |
| `DEBUG_MODE` | `1` = debug mode allowed and the default on this server; data shown instead of saved |
| `COMPENSATION`, `ESTIMATED_TASK_DURATION`, `EXPERIMENT_TITLE`, `EXPERIMENT_NAME`, `VERSION_DATE` | shown in the consent form / saved with the data |
| `ENVIRONMENT_TYPE` | `production` hides the API docs at `/docs` and requires `ADMIN_PASSWORD` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | login for the monitoring endpoints |
| `DATABASE_URL` | Postgres URL (Railway sets it); unset = local `database.db` |

## Checks

```bash
cd frontend && npm test && npm run typecheck && npm run lint
cd backend && uv run pytest && uv run ruff check .
```

The backend tests also check that `stimuli/study.json` is valid and that every image it
needs exists (`tests/test_study.py`). The server checks the same at startup and logs any
missing images.

## Stimuli

```
stimuli/
  study.json                                  what the experiment uses (below)
  pain_faces/Pain/<identity>/<0..60>.png     original pain morphs, samples 01 → 11
  pain_shine_rgba/images/Pain/<identity>/<0..60>.png  grayscale + SHINE morphs
  pain_shine_rgba/metrics.csv               current measurements
  pain_manifest.json                        source mapping and SHA-256 hashes
  examples/example_CFD_identities/<0..60>.png the practice morph (two identities)
```

`stimuli/study.json`:

```json
{
  "title": "Pain expression morphs",
  "faces_folder": "pain_shine_rgba/images",
  "extension": ".png",
  "frames": 61,
  "ends": [
    "Sample 01",
    "Sample 11"
  ],
  "studied_frames": [
    15,
    45
  ],
  "groups": {
    "Pain": [
      "BM51_PMS7",
      "DPD_1_BM12_p5b",
      "DPD_1_BM29_p4",
      "DPD_1_WM10_p5",
      "DPD_1_WM11_p4",
      "V1+target12+am+o+pms2",
      "V1+target3+wf+l+km4"
    ]
  },
  "practice": {
    "folder": "examples/example_CFD_identities",
    "frames": 61
  }
}
```

| Field | Meaning |
| --- | --- |
| `faces_folder`, `extension` | images are at `stimuli/<faces_folder>/<group>/<identity>/<frame><extension>` |
| `frames` | frames per identity, numbered 0 … frames − 1; participants reproduce on this whole range |
| `ends` | what frame 0 and the last frame look like; used in the results, Reveal and analysis report ("toward Sample 11") |
| `studied_frames` | the studied face is drawn from this range (inclusive) |
| `groups` | group name (= folder name) → identities; the first `NUM_IDENTITIES` of each are used, in this order |
| `practice` | folder and frame count of the practice morph; leave it out to skip the practice page |
| `title` | free text for your own reference (logged at startup) |

The pain branch retains pain sources, processed pain images, and the separate practice images; unused trait assets are archived outside the checkout before removal.

## Use your own faces

Only the `stimuli/` folder changes; no code. For example, painful vs. non-painful faces:

1. **Images.** Put each identity's morph in its own folder, one image per frame, named
   `0.png`, `1.png`, … in order from one end of the continuum to the other:

   ```
   stimuli/faces/Painful/ID_01/0.png … 60.png
   stimuli/faces/Painful/ID_02/…
   stimuli/faces/Nonpainful/ID_31/0.png … 60.png
   ```

   All identities need the same number of frames. Same size and format for all images;
   grayscale and a transparent or uniform background, like the current faces, work best.
2. **`stimuli/study.json`.** List the groups and identities, the frame count, the two
   ends and the studied range:

   ```json
   {
     "title": "Painful vs. non-painful faces",
     "faces_folder": "faces",
     "extension": ".png",
     "frames": 61,
     "ends": ["Neutral", "Pain"],
     "studied_frames": [15, 45],
     "groups": {
       "Painful": ["ID_01", "ID_02", "…"],
       "Nonpainful": ["ID_31", "ID_32", "…"]
     },
     "practice": {"folder": "examples/example_CFD_identities", "frames": 61}
   }
   ```

   More than two groups work too; each gets its own column in the results.
3. **Check:** `cd backend && uv run pytest tests/test_study.py` lists any missing image.
   Then run a few trials: <http://localhost:5173/exp/?trials=6&save=0>.
4. **Server settings:** set `NUM_IDENTITIES` to the identities per group you want, and
   change `EXPERIMENT_NAME` / `VERSION_DATE` so the data of the two studies can't be mixed
   up. Use a fresh database (or a new Railway service) for a new study, so balancing
   starts from zero.
5. **Words.** The instruction, consent and debriefing texts talk about faces in general.
   If your study needs different wording, edit `frontend/src/timeline/instructions.ts` and
   `frontend/src/pages/*.html`.

Large images slow the start of every trial (all frames of a face are loaded before it
appears): about 500 px and a few hundred KB per frame at most.

## Where things are

```
backend/
  app/config.py         all settings (env vars / .env) with defaults
  app/study.py          reads and checks stimuli/study.json
  app/models.py         database tables (participant, data, assignment) and statuses
  app/assignment.py     each participant's trial plan, balanced per pool
  app/participants.py   register / update status / save data / completion redirect
  app/api.py            public API used by the experiment   (/api/...)
  app/admin.py          password-protected monitoring       (/api/admin/...)
  app/main.py           wires it together; serves /exp (frontend) and /stimuli (images)
  cli.py                export data (incl. target_counts.csv), reset database
  tests/

frontend/src/
  main.ts               startup: mode → participant → server config → timeline → run
  config/mode.ts        the three modes and their phases
  config/debug.ts       the debug URL parameters
  config/constants.ts   timings, slider size and behaviour
  participant/          reading the participant ID parameters
  design/               slider ↔ frame maths, trial order, bias maths (tested)
  timeline/             the session, one file per section (intro, instructions, task, results, outro)
  pages/                text of consent / attrition / survey / debriefing (plain HTML)
  plugins/              jsPsych plugins: morph-reproduction (memory trial), form-page
  ui/                   circular slider, results plots, form validation, image cache, screens
  session/              saving data at the end, debug bar
  api/                  typed client for the backend (+ offline stand-in)
  dev/                  results preview page (report.html) and its sample data
  scripts/make-report.mjs   analysis report from exported data

stimuli/                the images and study.json (served at /stimuli/...)
```

Common edits:

- **Faces, groups, frame ranges** → `stimuli/` (see [Use your own faces](#use-your-own-faces))
- **Consent / survey / debriefing wording** → `frontend/src/pages/*.html`
- **Survey validation rules or messages** → attributes in `frontend/src/pages/survey.html`
  (`required`, `minlength`, `min`/`max`, `data-msg-required`, …)
- **Timings, slider size** → `frontend/src/config/constants.ts`
- **Which phases a mode runs** → `frontend/src/config/mode.ts`
- **Number of trials, payment, redirect** → server settings

## Data

Each completed session is one row in the `data` table: the full jsPsych data array
(`json_data`). Memory trials have `experiment_phase == "main"`:

| Column | Meaning |
| --- | --- |
| `group`, `identity` | group (from `study.json`, `Pain`) and face identity |
| `target_frame` | the studied frame |
| `response` | the reproduced frame |
| `error` | memory bias: `response − target_frame`, in frames (+ toward the last frame, Sample 11) |
| `start_frame` | the face shown when the slider appeared |
| `slider_start_angle`, `slider_start_value`, `response_angle` | where frame 0 sat on the ring, and where the handle started and ended |
| `rt`, `response_rt` | ms to "Next" from trial start / from the slider appearing |
| `stimuli_seen`, `stimuli_seen_times` | every frame displayed while responding |

Every row also has `worker_id`, `platform`, `session_mode`, `seed`, `refresh_count`,
`start_time`, `end_time` and `browser_events` (focus/blur/fullscreen changes). Survey
answers are in the `survey` row's `response` object (`race` is a list). For analysis, keep
participants with `condition` = `Intermixed` (drop `pilot` and `debug`).

### Design

- **One trial per identity**, all groups intermixed in random order.
- **Studied faces:** the seven identities receive seven distinct frames drawn from
  `studied_frames` (15–45 of 0–60), one per identity. The server balances each
  identity’s frame assignments across participants (see [Sampling and balancing](#sampling-and-balancing)).
- **Response:** the whole range 0–60. Half a turn of the slider sweeps frame 0 → 60, the
  other half back, so every frame is reachable from anywhere.
- **Hiding the scale:** on every trial, frame 0 sits at a random angle of the ring, and
  the slider starts at a random position at least 10 frames from the studied face.

### Memory-bias summary

The `results` phase (pilot and debug) shows, per group:

- **The trials:** which frames were viewed, which were reproduced, and an arrow per trial
  from one to the other.
- **The averages:** each group's mean shift drawn as an arrow from 0, with a table of the
  mean shift in frames, the direction in words ("toward Sample 11", or "no clear shift" below
  half a frame) and the mean error size.

When `results` didn't run, the same report appears above the raw data on a debug end screen.

### Export and analysis report

Export from `backend/`:

```bash
cd backend
uv run python cli.py export                   # local database → data/export/
railway run uv run python cli.py export       # Railway database → data/export/
```

- **Railway:** run `railway link` once and pick the pain service. Because a laptop can't reach
  Railway's internal database address, give the service one extra variable,
  `DATABASE_PUBLIC_URL=${{Postgres.DATABASE_PUBLIC_URL}}`; the export uses it, the server
  keeps using `DATABASE_URL`. The first line of the output shows which database it read.
- **Output:** `participants.csv`, `trials.csv` and `trials.json` (one row per jsPsych trial,
  with the participant's `condition`), and `target_counts.csv`.

Then draw the results page for the collected data, as one HTML file you can open or share:

```bash
cd frontend
npm run report -- ../data/export/trials.json                # experiment sessions
npm run report -- ../data/export/trials.json --mode pilot   # pilot sessions (or debug, all)
```

It writes `report.html` next to the input (or `--out file.html`): all participants pooled
(viewed / reproduced / shift plots and mean bias per group), a summary table per
participant, and each participant's own plots. Frames, end labels and groups come from
`stimuli/study.json` (another file: `--study path/to/study.json`).

Monitoring endpoints (basic auth with `ADMIN_USERNAME` / `ADMIN_PASSWORD`):

- `GET /api/admin/status`: number of participants per status
- `GET /api/admin/participants`: all participants
- `GET /api/admin/target-counts`: how often each studied frame of each identity was
  assigned in the experiment pool; `?pool=pilot` or `?pool=debug` for the others

### Sampling and balancing

When a participant opens the study, the server writes their plan to the `assignment`
table; a refresh returns the same plan. The rules:

| | Rule |
| --- | --- |
| Trials | one per identity: seven Pain identities = seven trials, in random order |
| Studied frames, per group | seven different frames from 15–45, one per identity; across participants each identity is balanced across all 31 studied frames |
| Which identity gets which frame | chosen so each identity is shown at every frame about equally often across participants: the server picks the matching of identities to frames that uses each identity's least-used frames, ties at random (`backend/app/matching.py`) |
| Groups | planned and counted independently |
| Response | always the whole range 0–60 |

- **What counts as "used":** completed sessions, and unfinished ones younger than
  `ABANDON_AFTER_MINUTES`. Frames from abandoned sessions are handed out again.
- **Pools:** each mode balances separately: experiment against experiment, pilot against
  pilot, debug against debug. So you can watch balancing during piloting
  (`/api/admin/target-counts?pool=pilot`) without touching the real study's counts.
- **`?trials=` (debug/pilot):** keeps a subset of the planned trials, split evenly between
  the groups, so a short session uses only some of the frames.

## Analysis

**Where the data is.** Participant data is never in git (no branch holds it; `data/` and
`*.db` are git-ignored). It lives in the database:

| Run | Database |
| --- | --- |
| Railway (real study) | the Railway Postgres service attached to the app |
| Local (`uvicorn` server) | `pain.db` in the repo root (SQLite, unless overridden) |

Each session is one row in the `data` table (all jsPsych trials as JSON), linked to its
row in `participant` (`condition` = `Intermixed` / `pilot` / `debug`).

**Which scripts.** Two steps, details in [Export and analysis report](#export-and-analysis-report):

1. [`backend/cli.py`](backend/cli.py) `export`: database → `data/export/`
   (`participants.csv`, `trials.csv`, `trials.json`, `target_counts.csv`).
   ```bash
   cd backend && railway run uv run python cli.py export
   ```
2. [`frontend/scripts/make-report.mjs`](frontend/scripts/make-report.mjs) (`npm run report`):
   `trials.json` → `data/export/report.html`, the results page for all participants.
   ```bash
   cd frontend && npm run report -- ../data/export/trials.json --mode pilot
   ```

For your own statistics, load `data/export/trials.csv` (one row per trial; memory trials
have `experiment_phase == "main"`, the bias column is `error`, see [Data](#data)).

### Analysis app (R / Shiny)

An interactive app for the exported data (old and new 1D formats): subject-level
raincloud, bias by starting frame, identity level, precision, other race, mixed models and
checks, with knobs for exclusions and the frame range. How to open it and what each tab
shows: [`analysis/README.md`](analysis/README.md).

```bash
Rscript -e 'shiny::runApp("analysis", launch.browser = TRUE)'
```

## Deploy (Railway)

Railway builds the `Dockerfile` (frontend build + FastAPI, with `stimuli/`). Set the server
settings in Railway → Variables (template: `railway.env.example`); `DATABASE_URL` comes from
the attached Postgres. Tables are created automatically at startup. Use a separate Railway
service (and database) from the original 1D and 2D studies.

## Pain branch

`pain` starts from `1D-continuum` at `16760502f`. It keeps the 1D task timing,
circular slider, randomization, frame balancing, recruitment and response format.
The active stimulus set is **seven identities × 61 frames = 427 images** in one
`Pain` group: one trial per identity, seven trials per full session. Studied frames
remain 15–45 inclusive; reproduction uses the full 0–60 range.

The images are byte-identical copies of the corrected
`face-morphing-tutorial/output/pain_faces_morph_61` PNGs, including the BM51 boundary
fix. No resizing or pixel changes are applied to the original copies.
Those originals remain 1024 × 1024 RGBA; a separate grayscale SHINE set is described below. Samples 01–11 appear at frames 0, 6, …, 60.
Endpoint labels are `Sample 01` and `Sample 11`: their order is preserved without
assuming a calibrated, linear pain-intensity scale. The three incomplete identities
are excluded. The original separate practice morph is retained, so practice does
not expose a study identity. Unused trait assets are archived outside this checkout.

`stimuli/pain_manifest.json` records every imported file's SHA-256 hash and outline
method. To repeat the import from the sibling morph repository:

```bash
python3 scripts/import_pain_stimuli.py
```

Pain defaults: `EXPERIMENT_NAME=memory_bias_pain`, `NUM_IDENTITIES=7`, version
`2026-10-16`, and a separate local `pain.db`. An existing `.env` or environment
variable overrides these defaults; check it before running this branch, especially
`DATABASE_URL` and `STIMULI_DIR`. Keep this study's database separate from the
original 1D/2D studies. Duration/payment text is inherited from 1D.

Quick local preview without a backend or saved participant data:

```bash
cd frontend
npm run dev
# Open http://localhost:5173/exp/?offline=1&phases=instructions,task,results
```

### Switch between original and SHINE stimuli

Both sets are **1024 × 1024 transparent RGBA PNGs**. The default grayscale set has standardized, centered face masks; color originals remain untouched for provenance. Each contains seven identities × 61
frames (`0.png` through `60.png`). The grayscale SHINE set is selected by default.

| Set | Frame location | Format |
| --- | --- | --- |
| Original | `stimuli/pain_faces/Pain/<identity>/<frame>.png` | Original color RGBA |
| Grayscale + SHINE | `stimuli/pain_shine_rgba/images/Pain/<identity>/<frame>.png` | Grayscale RGBA, size-normalized feathered alpha |

From the repository root:

```bash
python3 scripts/select_pain_stimuli.py shined
# Or return to the untouched color originals:
python3 scripts/select_pain_stimuli.py original
```

The selector validates the files and changes only `faces_folder` in
`stimuli/study.json`. Restart the backend (which caches this setting) and reload
the browser after switching; offline mode only needs a reload. Identities, timing,
frame order, studied range (15–45), response range (0–60), and the separate practice
example stay the same. Saved rows include `stimuli_faces_url`. Select the set before
a session; use separate databases/experiment names when collecting both variants.
Re-running `import_pain_stimuli.py` selects the originals again.

The wheel's face canvas is transparent and is cleared between images. The website's
actual background therefore shows through the face's feathered edges and throughout
the blank retention interval. The ring and blue handle remain visible. The inherited
practice images have their own baked-in backgrounds; canvas transparency does not
remove opaque pixels from those example images.

### Standardized size and centering (2026-10-16)

Run `python stimuli/normalize_pain_faces.py` with NumPy and Pillow installed to rebuild the default grayscale set from color originals. Visible face height (alpha ≥ 128) is 760–761 pixels on a 1024 × 1024 canvas; bounding-box center is within one pixel of (512, 512). Width retains natural face proportions. One fixed transform per identity is applied to all 61 frames, using premultiplied-alpha resampling for soft edges.

After resizing, linear Rec.709 grayscale luminance is matched using the affine mean/SD principle used by SHINIER. Mean target: 0.12034559 (previous SHINIER range midpoint). A common safe SD of 0.03991884 replaces 0.04278610 to avoid clipping. This is a new stimulus version; track it separately from earlier runs. Metrics use uncomposited RGB where alpha > 0. `pain_shine_rgba/metrics.csv`, `validation.json`, and `run.json` contain measurements and transforms. Color originals remain unnormalized and are for provenance or explicit comparison only.

The wheel has zero vertical image offset. Debug Reveal controls reserve space before appearing, preventing shifts when reproduction begins or the answer is revealed.

## Pain tutorial update (2026-10-22)

- 61 frames per identity, indexed 0–60; study targets 15–45 inclusive (31 frames, symmetric around 30). Responses use the full 0–60 range.
- Retains randomized wheel orientation and initial expression per trial, with the existing minimum 10-frame start distance; no 2D blank-start rule.
- Instructions → square-to-circle wheel exploration (at least five distinct frames) → full shape memory practice → studied/reproduced shape feedback → pain trials. Practice uses the same countdown, 1-second study display and 1.5-second blank interval as the main task.
- Shape practice is tagged `experiment_phase=practice`; feedback is `practice_feedback`, separate from main trials. Target, response, initial frame, wheel start angle/value and final response angle are saved by the existing trial plugin.
- Seven existing pain identities are available, each with all 61 files. This inventory is not a finalized trial count or demographic design. Endpoint labels remain the supplied Sample 01 / Sample 11 until stimulus provenance confirms their interpretation.
- Rebuild the tutorial PNGs with `python scripts/generate_shape_practice.py` (Pillow required only for regeneration).
- Validation: build/lint, 43 frontend tests and 26 backend tests passed; no missing stimulus files. Persistence tested by submitting practice/main rows and reading them back from an isolated database. No production data or deployment was changed.

Local review (offline, does not save): [Instructions, practice, then two pain trials](http://127.0.0.1:5180/exp/?mode=debug&offline=1&phases=instructions,task,results&trials=2&save=0&labels=0&seed=pain-tutorial-review).
