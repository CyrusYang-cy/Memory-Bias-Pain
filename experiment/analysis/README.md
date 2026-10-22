# Analysis app (1D)

An interactive R/Shiny app for the data of this study: plots you can hover, zoom and
filter, with the statistics next to them.

## Open it

1. **Install R** (once): <https://cran.r-project.org>. RStudio is optional.
2. **Install the packages** (once). In a terminal:

   ```bash
   Rscript -e 'install.packages(c("shiny", "bslib", "plotly", "DT", "lme4", "lmerTest", "tidyverse", "jsonlite"))'
   ```

3. **Start the app** from the repository folder (the one with `analysis/` in it):

   ```bash
   Rscript -e 'shiny::runApp("analysis", launch.browser = TRUE)'
   ```

   Your browser opens the app. Keep the terminal open while you use it; press
   <kbd>Ctrl</kbd>+<kbd>C</kbd> there to stop it.

   In **RStudio** instead: open `analysis/app.R` and click **Run App**.

## Which data it shows

Pick it at the top of the sidebar:

| Choice | File | How to get it |
| --- | --- | --- |
| Export | `data/export/trials.json` | `cd backend && railway run uv run python cli.py export` (Railway) or `uv run python cli.py export` (local). Old exports from the 2025–26 study work too. |
| Simulated sample | `analysis/sample/trials.json` | already there; `Rscript analysis/simulate.R` remakes it. 40 fake subjects with known effects (Dominant shifted 2 frames toward Anger, Submissive 2 toward Fear, a pull toward the middle), for trying the app. |
| Upload | any `trials.json` | the file picker |

The frame count, end labels (Anger … Fear) and group order come from
`stimuli/study.json`.

## Sidebar

- **Sessions:** experiment (default), pilot, debug or all.
- **Exclusions:** seriousness below 60; mean |error| more than 2 SD above the others (only
  much *less* accurate subjects are dropped). Both adjustable; the Exclusions tab lists who
  was dropped and why.
- **Studied frames included:** only trials whose viewed frame lies in this range count
  (default 15–45). Narrow it to zoom in on part of the morph.

## Tabs

| Tab | What it shows |
| --- | --- |
| Subject level | raincloud: one dot per subject = their mean bias (frames, + toward Fear), per condition, lines linking each subject's two conditions; t-tests vs 0 and paired, with Cohen's d |
| Starting frame | x = viewed frame, one dot per condition = mean bias of the trials that started there (± SE, smoothed trend); or mean response with the perfect-memory line |
| Identity level | mean bias per identity, sorted within condition; t-tests across identities |
| Precision | SD and MAD of the bias per starting frame |
| Other race | the raincloud split by same / other race (did not select "White") |
| Models | `error ~ group + (1 | subject) + (1 | identity)`, and with the starting frame (pull toward the middle) and its interaction with group |
| Checks | distinct frames per subject and group (should be 31), histograms of viewed and reproduced frames, identity × frame coverage |
| Exclusions | who was dropped and why |

## Files

```
analysis/app.R        the app (layout and plots)
analysis/R/load.R     reading the export (old and new format), exclusions
analysis/simulate.R   writes the simulated sample
analysis/sample/      the simulated sample
```
