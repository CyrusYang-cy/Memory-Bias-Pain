/**
 * Dev-only page (http://localhost:5173/exp/report.html): paste the "Per trial" table or the
 * raw data from a results page, and see the full results report for it.
 */
import "bootswatch/dist/flatly/bootstrap.min.css";
import "../styles/main.css";

import { biasReportFromTrials, type ReportStudy } from "../ui/bias-report";
import { parseTrials } from "./parse-trials";
import sample from "./sample-trials.tsv?raw";

document.body.innerHTML = `
  <main class="container my-4">
    <h1 class="h3">Results preview</h1>
    <p class="text-muted">Paste the "Per trial" table (tab-separated, as copied from a results
      page) or the raw data JSON, then press Draw. Starts with a made-up sample of 60 trials.</p>
    <textarea id="input" class="form-control font-monospace" rows="8"></textarea>
    <div class="my-2 d-flex gap-2 align-items-center">
      <button id="draw" class="btn btn-primary">Draw</button>
      <span id="status" class="text-muted"></span>
    </div>
    <div id="report"></div>
  </main>`;

const input = document.querySelector<HTMLTextAreaElement>("#input")!;
const status = document.querySelector<HTMLElement>("#status")!;
const report = document.querySelector<HTMLElement>("#report")!;
input.value = sample.trim();

// Frames, end labels and group order come from stimuli/study.json.
const study = (await fetch("/stimuli/study.json").then((r) => r.json())) as Omit<
  ReportStudy,
  "groups"
> & { groups: Record<string, string[]> };
const scale: ReportStudy = { ...study, groups: Object.keys(study.groups) };

function draw() {
  try {
    const trials = parseTrials(input.value);
    report.innerHTML = biasReportFromTrials(trials, scale) || "<p>No memory trials found.</p>";
    status.textContent = `${trials.length} trials`;
  } catch (error) {
    status.textContent = `Could not read the data: ${(error as Error).message}`;
  }
}

document.querySelector("#draw")!.addEventListener("click", draw);
draw();
