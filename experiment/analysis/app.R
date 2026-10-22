# Interactive analysis of the 1D memory-bias study.
#
#   From the repo root:  Rscript -e 'shiny::runApp("analysis", launch.browser = TRUE)'
#
# Reads data/export/trials.json (from `cd backend && uv run python cli.py export`; old and
# new data formats both work), the simulated sample (analysis/sample/trials.json, made by
# analysis/simulate.R), or a file you upload. Bias = reproduced − viewed frame; + means
# toward the last frame of the morph (see stimuli/study.json: "ends").

suppressPackageStartupMessages({
  library(shiny)
  library(bslib)
  library(DT)
  library(tidyr)
  library(plotly)
})
source("R/load.R")

EXPORT <- "../data/export/trials.json"
SAMPLE <- "sample/trials.json"
STUDY <- read_study()
PALETTE <- c("#2a78d6", "#eb6834", "#1baa7d", "#8a5cd8")
toward <- sprintf("+ toward %s, − toward %s", STUDY$ends[2], STUDY$ends[1])

dt <- function(df, digits = 3) {
  num <- names(df)[vapply(df, is.double, logical(1))]
  pcols <- intersect(num, "p")
  out <- datatable(df, rownames = FALSE, options = list(dom = "tip", pageLength = 10, scrollX = TRUE)) |>
    formatRound(setdiff(num, pcols), digits)
  if (length(pcols)) out <- formatSignif(out, pcols, 3)
  out
}

# One-sample and paired t-tests with Cohen's d.
t_row <- function(label, x) {
  x <- x[is.finite(x)]
  if (length(x) < 3) return(tibble(test = label, n = length(x)))
  tt <- t.test(x)
  tibble(test = label, n = length(x), mean = mean(x), sd = sd(x),
         t = unname(tt$statistic), df = unname(tt$parameter), p = tt$p.value,
         d = mean(x) / sd(x), ci_low = tt$conf.int[1], ci_high = tt$conf.int[2])
}

ui <- page_sidebar(
  title = "Memory bias · 1D",
  fillable = FALSE,
  theme = bs_theme(version = 5, bootswatch = "flatly"),
  sidebar = sidebar(
    width = 300,
    radioButtons("source", "Data", c(
      "Export (data/export/trials.json)" = "export",
      "Simulated sample" = "sample",
      "Upload a trials.json" = "upload"
    ), selected = if (file.exists(EXPORT)) "export" else "sample"),
    conditionalPanel("input.source == 'upload'", fileInput("upload", NULL, accept = ".json")),
    selectInput("kind", "Sessions", c("experiment", "pilot", "debug", "all")),
    tags$hr(),
    tags$b("Exclusions"),
    checkboxInput("use_serious", "Seriousness below", TRUE),
    numericInput("min_serious", NULL, 60, min = 1, max = 100),
    checkboxInput("use_sd", "Mean |error| more than k SD above the mean", TRUE),
    numericInput("k_sd", NULL, 2, min = 1, max = 5, step = 0.5),
    tags$hr(),
    sliderInput("frames", "Studied frames included", 0, STUDY$frames - 1, STUDY$studied, step = 1),
    helpText("Only trials whose viewed frame is in this range count (default: the studied",
             "range). Narrow it to look at one part of the morph."),
    tags$hr(),
    uiOutput("counts")
  ),
  navset_card_tab(
    nav_panel(
      "Subject level",
      layout_columns(
        col_widths = c(7, 5),
        plotlyOutput("rain", height = "520px"),
        div(checkboxInput("pairs", "Link each subject's two conditions", TRUE),
            h5("Tests (subject means)"), DTOutput("subject_tests"))
      ),
      helpText("Raincloud: density (cloud), box plot, one dot per subject = that subject's mean",
               paste0("bias in frames (", toward, ")."), "Hover a dot for the subject.")
    ),
    nav_panel(
      "Starting frame",
      layout_columns(
        col_widths = c(4, 4, 4),
        checkboxInput("se", "± 1 SE bars", TRUE),
        checkboxInput("smooth", "Smoothed trend", TRUE),
        selectInput("y_what", "Show", c("mean bias" = "bias", "mean response" = "response"))
      ),
      plotlyOutput("by_frame", height = "500px"),
      helpText("x = the viewed (starting) frame; one dot per condition at each frame = mean over",
               "all trials that started there. Zoom with the frame slider or by dragging a box.",
               "\"Mean response\" adds the identity line (perfect memory)."),
      DTOutput("frame_table")
    ),
    nav_panel(
      "Identity level",
      plotlyOutput("identity_bars", height = "460px"),
      DTOutput("identity_tests")
    ),
    nav_panel(
      "Precision",
      plotlyOutput("precision", height = "420px"),
      helpText("Spread of the bias at each starting frame (SD and median absolute deviation),",
               "per condition: lower = more precise memory.")
    ),
    nav_panel(
      "Other race",
      plotlyOutput("race_rain", height = "460px"),
      DTOutput("race_tests")
    ),
    nav_panel(
      "Models",
      helpText("Linear mixed models on the trials in the frame range."),
      verbatimTextOutput("models")
    ),
    nav_panel(
      "Checks",
      h5("Distinct viewed frames per subject and group (should equal the trials)"),
      DTOutput("distinct"),
      layout_columns(plotlyOutput("hist_target", height = "300px"), plotlyOutput("hist_response", height = "300px")),
      plotlyOutput("coverage", height = "520px")
    ),
    nav_panel("Exclusions", DTOutput("excluded"))
  )
)

server <- function(input, output, session) {
  raw <- reactive({
    path <- switch(input$source,
      export = EXPORT, sample = SAMPLE,
      upload = { req(input$upload); input$upload$datapath }
    )
    shiny::validate(need(file.exists(path), paste(
      "No data at", path, "- export first (cd backend && uv run python cli.py export),",
      "or run Rscript analysis/simulate.R for the sample."
    )))
    d <- read_export(path)
    shiny::validate(need(nrow(d$trials) > 0, paste(
      "No 1D memory trials in", path, "- is it a 2D export? Choose another file or the sample."
    )))
    d
  })
  sessions <- reactive({
    d <- raw()
    t <- if (input$kind == "all") d$trials else filter(d$trials, kind == input$kind)
    list(trials = t, survey = filter(d$survey, worker_id %in% t$worker_id))
  })
  dropped <- reactive({
    s <- sessions()
    exclusions(s$trials, s$survey, input$min_serious, input$use_serious, input$k_sd, input$use_sd)
  })
  trials <- reactive({
    t <- sessions()$trials |>
      filter(!worker_id %in% dropped()$worker_id,
             target_frame >= input$frames[1], target_frame <= input$frames[2])
    shiny::validate(need(nrow(t) > 0, "No trials for these settings (try Sessions: all, or a wider frame range)."))
    t
  })
  groups <- reactive({
    present <- unique(trials()$group)
    c(intersect(STUDY$groups, present), sort(setdiff(present, STUDY$groups)))
  })
  colour <- function(g) PALETTE[(match(g, groups()) - 1) %% length(PALETTE) + 1]
  subjects <- reactive({
    trials() |> group_by(worker_id, group) |>
      summarise(n = n(), bias = mean(error), abs_error = mean(abs(error)), .groups = "drop")
  })

  output$counts <- renderUI({
    s <- sessions()
    tags$small(sprintf(
      "%d subjects, %d trials loaded; %d excluded; %d trials in the frame range.",
      n_distinct(s$trials$worker_id), nrow(s$trials), nrow(dropped()), nrow(trials())
    ))
  })

  # --- Subject level ----------------------------------------------------------------------
  raincloud <- function(d, xvar, ytitle) {
    p <- plot_ly()
    levels <- unique(d[[xvar]])
    for (i in seq_along(levels)) {
      lv <- levels[i]
      dd <- d[d[[xvar]] == lv, ]
      col <- if (lv %in% groups()) colour(lv) else PALETTE[(i - 1) %% 4 + 1]
      p <- p |>
        add_trace(type = "violin", x = rep(i - 1, nrow(dd)), y = dd$bias, side = "positive",
                  width = 0.8, points = FALSE, box = list(visible = TRUE, width = 0.15),
                  line = list(color = col), fillcolor = col, opacity = 0.35, name = lv,
                  hoverinfo = "skip") |>
        add_markers(x = jitter(rep(i - 1, nrow(dd)), amount = 0.08) - 0.18, y = dd$bias,
                    marker = list(color = col, size = 7, opacity = 0.8), name = lv,
                    text = sprintf("%s<br>%d trials<br>bias %+.2f", dd$worker_id, dd$n, dd$bias),
                    hoverinfo = "text")
    }
    p |> layout(
      xaxis = list(title = "", tickmode = "array", tickvals = seq_along(levels) - 1, ticktext = levels,
                   range = c(-0.6, length(levels) - 0.2), zeroline = FALSE),
      yaxis = list(title = ytitle, zeroline = TRUE, zerolinecolor = "#6c757d"),
      showlegend = FALSE
    ) |> config(displaylogo = FALSE)
  }
  output$rain <- renderPlotly({
    s <- subjects() |> mutate(group = factor(group, groups())) |> arrange(group)
    s$group <- as.character(s$group)
    p <- raincloud(s, "group", paste0("subject mean bias (frames; ", toward, ")"))
    if (input$pairs && length(groups()) == 2) {
      w <- s |> select(worker_id, group, bias) |> pivot_wider(names_from = group, values_from = bias) |> drop_na()
      for (k in seq_len(nrow(w))) {
        p <- p |> add_segments(x = -0.18, xend = 0.82, y = w[[groups()[1]]][k], yend = w[[groups()[2]]][k],
                               line = list(color = "rgba(0,0,0,0.12)", width = 1), hoverinfo = "skip",
                               inherit = FALSE)
      }
    }
    p
  })
  output$subject_tests <- renderDT({
    s <- subjects()
    g <- groups()
    rows <- map_dfr(g, ~ t_row(paste(.x, "vs 0"), filter(s, group == .x)$bias))
    if (length(g) == 2) {
      w <- s |> select(worker_id, group, bias) |> pivot_wider(names_from = group, values_from = bias) |> drop_na()
      rows <- bind_rows(rows, t_row(sprintf("%s − %s (paired)", g[2], g[1]), w[[g[2]]] - w[[g[1]]]))
    }
    dt(rows)
  })

  # --- Starting frame ---------------------------------------------------------------------
  by_frame <- reactive({
    trials() |> group_by(group, target_frame) |>
      summarise(n = n(), bias = mean(error), response = mean(response),
                se_bias = sd(error) / sqrt(n()), se_response = sd(response) / sqrt(n()),
                .groups = "drop")
  })
  output$by_frame <- renderPlotly({
    d <- by_frame()
    y <- input$y_what
    p <- plot_ly()
    for (i in seq_along(groups())) {
      g <- groups()[i]
      dg <- filter(d, group == g)
      dodge <- (i - (length(groups()) + 1) / 2) * 0.18
      err <- if (input$se) list(type = "data", array = dg[[paste0("se_", y)]], color = colour(g), thickness = 1) else NULL
      p <- p |> add_markers(
        x = dg$target_frame + dodge, y = dg[[y]], name = g, error_y = err,
        marker = list(color = colour(g), size = 8),
        text = sprintf("%s · frame %d<br>%d trials<br>mean %s %.2f", g, dg$target_frame, dg$n, y, dg[[y]]),
        hoverinfo = "text"
      )
      if (input$smooth && nrow(dg) >= 5) {
        fit <- loess(dg[[y]] ~ dg$target_frame, weights = dg$n, span = 0.75)
        p <- p |> add_lines(x = dg$target_frame, y = predict(fit), name = paste(g, "trend"),
                            line = list(color = colour(g), width = 2), hoverinfo = "skip")
      }
    }
    if (y == "response") {
      p <- p |> add_lines(x = input$frames, y = input$frames, name = "perfect memory",
                          line = list(color = "#adb5bd", dash = "dash"), hoverinfo = "skip")
    }
    p |> layout(
      xaxis = list(title = sprintf("viewed frame (0 = %s … %d = %s)", STUDY$ends[1], STUDY$frames - 1, STUDY$ends[2]),
                   range = c(input$frames[1] - 1, input$frames[2] + 1)),
      yaxis = list(title = if (y == "bias") paste0("mean bias (frames; ", toward, ")") else "mean reproduced frame",
                   zeroline = TRUE)
    ) |> config(displaylogo = FALSE)
  })
  output$frame_table <- renderDT({
    by_frame() |> select(group, target_frame, n, bias, se_bias, response) |>
      pivot_wider(names_from = group, values_from = c(n, bias, se_bias, response)) |> dt()
  })

  # --- Identity level ---------------------------------------------------------------------
  identities <- reactive({
    trials() |> group_by(group, identity) |> summarise(n = n(), bias = mean(error), .groups = "drop")
  })
  output$identity_bars <- renderPlotly({
    d <- identities() |> arrange(group, desc(bias)) |> mutate(key = paste(group, identity))
    plot_ly(d, x = ~key, y = ~bias, type = "bar", color = ~group,
            colors = setNames(map_chr(groups(), colour), groups()),
            text = ~sprintf("%s %s<br>%d trials<br>bias %+.2f", group, identity, n, bias),
            hoverinfo = "text", textposition = "none") |>
      layout(xaxis = list(title = "identity (sorted within condition)", categoryorder = "array",
                          categoryarray = d$key, showticklabels = FALSE),
             yaxis = list(title = paste0("identity mean bias (", toward, ")"))) |>
      config(displaylogo = FALSE)
  })
  output$identity_tests <- renderDT({
    d <- identities()
    dt(map_dfr(groups(), ~ t_row(paste(.x, "identities vs 0"), filter(d, group == .x)$bias)))
  })

  # --- Precision --------------------------------------------------------------------------
  output$precision <- renderPlotly({
    d <- trials() |> group_by(group, target_frame) |>
      summarise(sd = sd(error), mad = mad(error), n = n(), .groups = "drop")
    p <- plot_ly()
    for (g in groups()) {
      dg <- filter(d, group == g)
      p <- p |>
        add_lines(x = dg$target_frame, y = dg$sd, name = paste(g, "SD"), line = list(color = colour(g))) |>
        add_lines(x = dg$target_frame, y = dg$mad, name = paste(g, "MAD"), line = list(color = colour(g), dash = "dot"))
    }
    p |> layout(xaxis = list(title = "viewed frame"), yaxis = list(title = "spread of the bias (frames)")) |>
      config(displaylogo = FALSE)
  })

  # --- Other race -------------------------------------------------------------------------
  race_subjects <- reactive({
    subjects() |>
      left_join(select(sessions()$survey, worker_id, other_race), by = "worker_id") |>
      mutate(race = ifelse(is.na(other_race), "unknown", ifelse(other_race, "other race", "same race")),
             cell = paste(group, "·", race))
  })
  output$race_rain <- renderPlotly({
    raincloud(arrange(race_subjects(), group, race), "cell", paste0("subject mean bias (", toward, ")"))
  })
  output$race_tests <- renderDT({
    r <- race_subjects()
    dt(map_dfr(sort(unique(r$cell)), ~ t_row(paste(.x, "vs 0"), filter(r, cell == .x)$bias)))
  })

  # --- Models -----------------------------------------------------------------------------
  output$models <- renderPrint({
    suppressPackageStartupMessages(library(lmerTest))
    d <- trials() |> mutate(start_c = target_frame - mean(STUDY$studied))
    shiny::validate(need(n_distinct(d$worker_id) >= 3, "Need at least 3 subjects for the models."))
    show <- function(formula) {
      cat("====", formula, "\n")
      fit <- suppressMessages(lmer(as.formula(formula), data = d))
      print(coef(summary(fit)))
      cat("\n")
    }
    show("error ~ group + (1 | worker_id) + (1 | identity)")
    show("error ~ group * start_c + (1 | worker_id) + (1 | identity)")
    cat("start_c = viewed frame minus the middle of the studied range; its slope is the pull\n",
        "toward the middle (regression to the mean), the interaction asks whether it differs\n",
        "between the groups.\n")
  })

  # --- Checks -----------------------------------------------------------------------------
  output$distinct <- renderDT({
    sessions()$trials |> group_by(worker_id, group) |>
      summarise(trials = n(), distinct = n_distinct(target_frame), .groups = "drop") |>
      mutate(ok = trials == distinct) |> arrange(ok, worker_id) |> dt()
  })
  hist <- function(var, title) renderPlotly({
    plot_ly(x = trials()[[var]], type = "histogram", color = trials()$group,
            colors = setNames(map_chr(groups(), colour), groups()), xbins = list(size = 1)) |>
      layout(barmode = "overlay", title = title, xaxis = list(title = "frame")) |>
      config(displaylogo = FALSE)
  })
  output$hist_target <- hist("target_frame", "Viewed frames")
  output$hist_response <- hist("response", "Reproduced frames")
  output$coverage <- renderPlotly({
    d <- trials() |> count(group, identity, target_frame)
    plot_ly(d, x = ~target_frame, y = ~paste(group, identity), z = ~n, type = "heatmap",
            colorscale = "Blues", hovertemplate = "%{y}<br>frame %{x}: %{z} subjects<extra></extra>") |>
      layout(title = "How often each identity was viewed at each frame",
             xaxis = list(title = "viewed frame"), yaxis = list(title = "", tickfont = list(size = 8))) |>
      config(displaylogo = FALSE)
  })

  output$excluded <- renderDT(dt(dropped()))
}

shinyApp(ui, server)
