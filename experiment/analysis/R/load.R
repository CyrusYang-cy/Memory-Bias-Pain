# Reading an export (data/export/trials.json from `backend/cli.py export`) into tidy tables.
#
# Two formats are understood, so old and new data go through the same analysis:
#   - new (this branch): experiment_phase "main", group, identity, target_frame, response;
#     survey answers in the "survey" row's `response` object.
#   - old (2025-26 Prolific/SONA study): trial_type "circular-slider-image-morpher",
#     initial_stimulus_value (studied frame), response, and the group in `condition` /
#     `block_condition`; survey answers as a JSON string in `form_data`.
#
# trials.json is used rather than trials.csv: the CSV writes nested values (survey answers,
# the race list) as Python text, the JSON keeps them as real lists.

suppressPackageStartupMessages({
  library(dplyr)
  library(purrr)
  library(tibble)
  library(jsonlite)
})

num <- function(x) if (is.null(x) || length(x) == 0) NA_real_ else suppressWarnings(as.numeric(x[[1]]))
chr <- function(x) if (is.null(x) || length(x) == 0) NA_character_ else as.character(x[[1]])

# experiment / pilot / debug, from the participant's condition (or the data's session_mode).
session_kind <- function(condition, session_mode) {
  case_when(
    condition %in% "pilot" | session_mode %in% "pilot" ~ "pilot",
    condition %in% "debug" | session_mode %in% "debug" ~ "debug",
    TRUE ~ "experiment"
  )
}

#' The study description (frames, end labels, groups) from stimuli/study.json.
read_study <- function(path = "../stimuli/study.json") {
  s <- fromJSON(path, simplifyVector = TRUE)
  list(frames = s$frames, ends = s$ends, groups = names(s$groups), studied = s$studied_frames)
}

is_new_trial <- function(r) identical(r$experiment_phase, "main") && !is.null(r$target_frame)
is_old_trial <- function(r) identical(r$trial_type, "circular-slider-image-morpher")

#' Read an export. Returns list(trials = memory trials, survey = one row per participant).
read_export <- function(path) {
  rows <- fromJSON(path, simplifyVector = FALSE)

  main <- keep(rows, ~ is_new_trial(.x) || is_old_trial(.x))
  trials <- tibble(
    worker_id = map_chr(main, ~ chr(.x$worker_id %||% .x$sona_id)),
    format = map_chr(main, ~ if (is_new_trial(.x)) "new" else "old"),
    # New data: condition = the participant's (Intermixed / pilot / debug). Old data: the
    # trial's group (Dominant / Submissive) is in condition or block_condition.
    condition = map_chr(main, ~ chr(.x$condition)),
    session_mode = map_chr(main, ~ chr(.x$session_mode)),
    group = map_chr(main, ~ chr(.x$group %||% .x$block_condition %||% .x$condition)),
    identity = map_chr(main, ~ chr(.x$identity)),
    trial_number = map_dbl(main, ~ num(.x$trial_number)),
    target_frame = map_dbl(main, ~ num(.x$target_frame %||% .x$initial_stimulus_value)),
    response = map_dbl(main, ~ num(.x$response)),
    rt = map_dbl(main, ~ num(.x$rt))
  ) |>
    filter(!is.na(target_frame), !is.na(response)) |>
    mutate(
      kind = ifelse(format == "old", "experiment", session_kind(condition, session_mode)),
      error = response - target_frame
    )

  surveys <- keep(rows, ~ identical(.x$experiment_phase, "survey"))
  answers <- function(r) {
    if (is.list(r$response) && length(r$response)) return(r$response)
    if (is.character(r$form_data) && nzchar(r$form_data)) {
      return(tryCatch(fromJSON(r$form_data, simplifyVector = FALSE), error = function(e) list()))
    }
    list()
  }
  survey <- tibble(
    worker_id = map_chr(surveys, ~ chr(.x$worker_id %||% .x$sona_id)),
    a = map(surveys, answers)
  ) |>
    mutate(
      seriousness = map_dbl(a, ~ num(.x$seriousness)),
      race = map_chr(a, ~ paste(unlist(.x$race), collapse = "; ")),
      age = map_dbl(a, ~ num(.x$age)),
      gender = map_chr(a, ~ chr(.x$gender))
    ) |>
    select(-a) |>
    # "Other race" = did not select White (the face set is White men).
    mutate(other_race = !grepl("White", race, ignore.case = TRUE)) |>
    distinct(worker_id, .keep_all = TRUE)

  list(trials = trials, survey = survey)
}

#' Subjects to drop, with the reason.
#'  - seriousness below `min_seriousness` (survey answer, 1-100)
#'  - mean absolute error more than `k_sd` SD above the sample mean (much less accurate than
#'    the others; unusually accurate subjects are kept).
#'    Error size, not signed bias, decides: the signed bias is what we test.
exclusions <- function(trials, survey, min_seriousness = 60, use_seriousness = TRUE,
                       k_sd = 2, use_sd = TRUE) {
  dropped <- tibble(worker_id = character(), reason = character())
  if (use_seriousness && nrow(survey) > 0) {
    dropped <- bind_rows(
      dropped,
      survey |>
        filter(!is.na(seriousness), seriousness < min_seriousness) |>
        transmute(worker_id, reason = sprintf("seriousness %g < %g", seriousness, min_seriousness))
    )
  }
  if (use_sd && nrow(trials) > 0) {
    per <- trials |>
      filter(!worker_id %in% dropped$worker_id) |>
      group_by(worker_id) |>
      summarise(err = mean(abs(error)), .groups = "drop")
    if (nrow(per) > 2) {
      m <- mean(per$err)
      s <- sd(per$err)
      dropped <- bind_rows(
        dropped,
        per |>
          filter(err - m > k_sd * s) |>
          transmute(worker_id, reason = sprintf(
            "mean |error| %.2f frames, %.1f SD above the mean %.2f", err, (err - m) / s, m
          ))
      )
    }
  }
  dropped
}
