/**
 * Full-page messages shown outside of the jsPsych timeline (errors, saving, completion).
 */
import { escapeHtml } from "./template";

type Tone = "info" | "success" | "danger";

/** Replace the page content with a message. `html` is trusted markup. */
export function showScreen(html: string, tone: Tone = "info", target: HTMLElement = document.body) {
  target.innerHTML = `
    <main class="screen container">
      <div class="alert alert-${tone} screen__message">${html}</div>
    </main>`;
}

export function showError(message: string, target?: HTMLElement) {
  showScreen(`<p class="mb-0">${escapeHtml(message)}</p>`, "danger", target);
}

export function showSaving(target?: HTMLElement) {
  showScreen(`<p class="mb-0">Saving your responses, please wait&hellip;</p>`, "info", target);
}

export function showSaveFailed(contactEmail: string, completionCode: string, target?: HTMLElement) {
  showScreen(
    `<p>We could not save your responses. Please email
       <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>
       and include this code:</p>
     <p class="mb-0"><code>${escapeHtml(completionCode)}</code></p>`,
    "danger",
    target,
  );
}

export function showRedirect(url: string, target?: HTMLElement, delayMs = 3000) {
  showScreen(
    `<p>Thanks for participating! You will be redirected in a few moments to have your
       participation recorded.</p>
     <p class="mb-0">If nothing happens, <a class="alert-link" href="${escapeHtml(url)}">click here</a>.</p>`,
    "success",
    target,
  );
  setTimeout(() => window.location.assign(url), delayMs);
}

export function showPilotSaved(workerId: string, target?: HTMLElement) {
  showScreen(
    `<p>Pilot session saved (participant <code>${escapeHtml(workerId)}</code>, marked as pilot).</p>
     <p class="mb-0">You can close this window.</p>`,
    "success",
    target,
  );
}

export function showCompletionCode(code: string, target?: HTMLElement) {
  showScreen(
    `<p>Thanks for participating! Your completion code is:</p>
     <p><strong><code>${escapeHtml(code)}</code></strong></p>
     <p class="mb-0">Please copy it into the corresponding box on the study website to
       receive compensation.</p>`,
    "success",
    target,
  );
}

/** Debug mode: show the collected data (saved or not). */
export function showData(
  data: unknown,
  summaryHtml = "",
  saved = false,
  target: HTMLElement = document.body,
) {
  target.innerHTML = `
    <main class="container my-4">
      <div class="alert alert-warning">Debug mode: data was ${saved ? "saved (marked as debug)" : "<strong>not</strong> saved"}.
        It is also in the console as <code>window.__exp.data</code>.</div>
      ${summaryHtml}
      <h2 class="h4 mt-4">All data</h2>
      <pre class="debug-data">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
    </main>`;
}
