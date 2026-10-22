import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from "jspsych";

import { enableLiveValidation } from "../ui/form-validation";
import { enhanceMultiSelects } from "../ui/multiselect";

const info = <const>{
  name: "form-page",
  version: "2.0.0",
  parameters: {
    /** Page content, including any form fields (without the surrounding <form>). */
    html: { type: ParameterType.HTML_STRING, default: undefined },
    button_label: { type: ParameterType.STRING, default: "Next" },
    /**
     * Extra validation beyond HTML attributes (required, pattern, min, ...).
     * Receives the form; returns an error message to show, or null if valid.
     */
    validate: { type: ParameterType.FUNCTION, default: null },
  },
  data: {
    /** Field name → value; multi-selects and checkbox groups give arrays. */
    response: { type: ParameterType.OBJECT },
    rt: { type: ParameterType.INT },
  },
};

type Info = typeof info;
/** Trial parameters after jsPsych has filled in the defaults. */
type Trial = Required<TrialType<Info>>;
type FormResponse = Record<string, string | string[]>;

/**
 * A page of HTML with a "Next" button. Fields are validated live from their HTML
 * attributes (`required`, `pattern`, `min`, `minlength`, ...; see ui/form-validation.ts),
 * plus an optional `validate` function on submit. `<select multiple
 * data-enhance="multiselect">` becomes a searchable dropdown (ui/multiselect.ts).
 *
 * Simulation fills every field automatically. Set `data-sim-value` on a field to choose
 * what the simulation enters (e.g. for fields with a `pattern`).
 */
class FormPagePlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private readonly jsPsych: JsPsych) {}

  // Synchronous trial(): jsPsych calls `on_load` itself once this returns (only async
  // trials and simulate() call it themselves).
  trial(display: HTMLElement, trial: Trial) {
    display.innerHTML = `
      <form class="form-page container text-start" novalidate>
        ${trial.html}
        <div class="form-page__error alert alert-danger" role="alert" hidden></div>
        <div class="text-center my-4">
          <button type="submit" class="btn btn-lg btn-primary">${trial.button_label}</button>
        </div>
      </form>`;
    const form = display.querySelector<HTMLFormElement>("form")!;
    const errorBox = form.querySelector<HTMLElement>(".form-page__error")!;
    enhanceMultiSelects(form);
    const validation = enableLiveValidation(form);
    const start = performance.now();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const fieldsValid = validation.validateAll();
      const customError = (trial.validate as ((f: HTMLFormElement) => string | null) | null)?.(
        form,
      );
      if (!fieldsValid || customError) {
        errorBox.textContent = customError ?? "Please correct the fields marked in red.";
        errorBox.hidden = false;
        focusField(validation.firstInvalid());
        return;
      }
      const rt = Math.round(performance.now() - start);
      display.innerHTML = "";
      this.jsPsych.finishTrial({ response: serializeForm(form), rt });
    });
  }

  simulate(
    trial: Trial,
    mode: "data-only" | "visual",
    options: { data?: Record<string, unknown> },
    onLoad?: () => void,
  ) {
    if (mode === "data-only") {
      onLoad?.();
      const form = document.createElement("form");
      form.innerHTML = trial.html;
      fillForm(form);
      const defaults = { response: serializeForm(form), rt: 2000 };
      this.jsPsych.finishTrial(this.jsPsych.pluginAPI.mergeSimulationData(defaults, options));
      return;
    }
    const display = this.jsPsych.getDisplayElement();
    this.trial(display, trial);
    onLoad?.();
    const form = display.querySelector<HTMLFormElement>("form")!;
    fillForm(form);
    this.jsPsych.pluginAPI.clickTarget(form.querySelector('button[type="submit"]')!, 800);
  }
}

/** Collect named fields. Multi-selects and checkbox groups always give arrays. */
export function serializeForm(form: HTMLFormElement): FormResponse {
  const response: FormResponse = {};
  const multiSelects = [...form.querySelectorAll<HTMLSelectElement>("select[multiple][name]")];
  for (const select of multiSelects) {
    response[select.name] = [...select.selectedOptions].map((option) => option.value);
  }
  for (const box of form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]')) {
    response[box.name] ??= [];
  }
  const skip = new Set(multiSelects.map((select) => select.name));
  for (const [name, raw] of new FormData(form)) {
    if (skip.has(name)) continue;
    const value = String(raw);
    const previous = response[name];
    if (Array.isArray(previous)) previous.push(value);
    else response[name] = value;
  }
  return response;
}

function focusField(field: Element | null): void {
  const enhanced = (field as { tomselect?: { focus(): void } } | null)?.tomselect;
  if (enhanced) enhanced.focus();
  else if (field instanceof HTMLElement) field.focus();
}

/** Fill every field with a valid-looking value (used for simulation only). */
function fillForm(form: HTMLFormElement) {
  const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input[name], select[name], textarea[name]",
  );
  const handledGroups = new Set<string>();
  for (const field of fields) {
    const simValue = field.dataset.simValue;
    if (field instanceof HTMLSelectElement) {
      const option = [...field.options].find((o) => o.value !== "");
      if (!option) continue;
      const tomselect = (field as { tomselect?: { setValue(v: string): void } }).tomselect;
      if (tomselect) tomselect.setValue(simValue ?? option.value);
      else field.value = simValue ?? option.value;
    } else if (
      field instanceof HTMLInputElement &&
      (field.type === "radio" || field.type === "checkbox")
    ) {
      if (handledGroups.has(field.name)) continue;
      handledGroups.add(field.name);
      const group = form.querySelectorAll<HTMLInputElement>(`input[name="${field.name}"]`);
      const choice = [...group].find((f) => f.dataset.simValue !== undefined) ?? group[0]!;
      choice.checked = true;
    } else if (field instanceof HTMLInputElement && field.type === "number") {
      field.value = simValue ?? (field.min || "1");
    } else {
      field.value = simValue ?? "Simulated response text.";
    }
  }
}

export default FormPagePlugin;
