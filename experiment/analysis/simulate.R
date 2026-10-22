# Writes a fake export (analysis/sample/trials.json) with known effects, so the app can be
# tried before real data exists and checked to find what was planted:
#
#   - Dominant faces remembered 2 frames toward the first end (Anger), Submissive 2 frames
#     toward the last end (Fear);
#   - regression toward the middle of the morph (frame 30): 25% of the way;
#   - per-subject offsets and trial noise (SD 5 frames);
#   - 3 subjects with low seriousness and 1 very noisy subject (exclusion checks).
#
# Each subject sees every studied frame (15-45) once per group, like the real design.
# Run from the repo root:  Rscript analysis/simulate.R

suppressPackageStartupMessages(library(jsonlite))
set.seed(2026)

here <- if (dir.exists("analysis")) "analysis" else "."
study <- fromJSON(file.path(here, "..", "stimuli", "study.json"))
frames <- study$studied_frames[1]:study$studied_frames[2]
last <- study$frames - 1
shift <- c(-2, 2)
names(shift) <- names(study$groups)[1:2]

rows <- list()
for (s in 1:40) {
  worker <- sprintf("SIM%02d", s)
  noise <- if (s == 40) 16 else 5
  offset <- rnorm(1, 0, 1.5)
  plan <- do.call(rbind, lapply(names(shift), function(g) {
    ids <- study$groups[[g]][seq_along(frames)]
    data.frame(group = g, identity = ids, target = sample(frames))
  }))
  plan <- plan[sample(nrow(plan)), ]
  for (i in seq_len(nrow(plan))) {
    t <- plan$target[i]
    r <- t + shift[[plan$group[i]]] + offset - 0.25 * (t - 30) + rnorm(1, 0, noise)
    r <- max(0, min(last, round(r)))
    rows[[length(rows) + 1]] <- list(
      worker_id = worker, condition = "Intermixed", session_mode = "experiment",
      experiment_phase = "main", trial_number = i, group = plan$group[i],
      identity = plan$identity[i], target_frame = t, response = r, error = r - t,
      rt = round(4500 + rexp(1, 1 / 2500))
    )
  }
  rows[[length(rows) + 1]] <- list(
    worker_id = worker, condition = "Intermixed", experiment_phase = "survey",
    response = list(
      seriousness = if (s %in% c(7, 18, 29)) 40 else sample(70:100, 1),
      race = if (s %% 4 == 0) list("Asian") else list("White"),
      age = sample(18:30, 1), gender = sample(c("woman", "man"), 1)
    )
  )
}

dir.create(file.path(here, "sample"), showWarnings = FALSE)
out <- file.path(here, "sample", "trials.json")
write_json(rows, out, auto_unbox = TRUE)
cat("Wrote", length(rows), "rows (40 simulated subjects) to", out, "\n")
