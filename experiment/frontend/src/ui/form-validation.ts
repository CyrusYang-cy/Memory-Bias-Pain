/**
 * Live form validation with inline messages, in the style of the jQuery-validation setup
 * used in v1: a field is checked as soon as the participant types in it (and when they
 * leave it), and a specific message appears under it ("Please enter at least 5
 * characters."). After a submit attempt, every field is checked.
 *
 * Rules come from standard HTML attributes (required, minlength, min, max, step, pattern).
 * Override a message per field with data attributes:
 *   data-msg-required, data-msg-minlength, data-msg-range, data-msg-pattern
 */

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const FIELD_SELECTOR = "input[name], select[name], textarea[name]";

export interface LiveValidation {
  /** Check every field and show all messages; returns true if the form is valid. */
  validateAll(): boolean;
  /** First invalid field, for focusing. */
  firstInvalid(): Field | null;
}

export function enableLiveValidation(form: HTMLFormElement): LiveValidation {
  const touched = new Set<Field>();
  let submitted = false;

  const onEdit = (event: Event) => {
    const field = asField(event.target);
    if (!field) return;
    touched.add(field);
    validateGroup(form, field);
  };
  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);
  form.addEventListener("focusout", (event) => {
    const field = asField(event.target);
    if (field && (touched.has(field) || submitted)) validateGroup(form, field);
  });

  return {
    validateAll() {
      submitted = true;
      let valid = true;
      for (const field of fields(form)) valid = validateField(field) && valid;
      return valid;
    },
    firstInvalid() {
      return fields(form).find((f) => !f.checkValidity()) ?? null;
    },
  };
}

/** The message to show for a field, or null if it is valid. */
export function errorMessage(field: Field): string | null {
  const msg = field.dataset;
  const value = field.value.trim();

  // `minlength` is only enforced natively after real typing; check it explicitly so
  // pasted and programmatic values are treated the same.
  const minLength = "minLength" in field ? field.minLength : -1;
  if (value !== "" && minLength > 0 && value.length < minLength) {
    return msg.msgMinlength ?? `Please enter at least ${minLength} characters.`;
  }

  const v = field.validity;
  if (v.valid) return null;
  if (v.valueMissing) return msg.msgRequired ?? "This field is required.";
  if (v.patternMismatch) return msg.msgPattern ?? "Please check your input.";
  if (v.tooLong)
    return `Please enter no more than ${(field as HTMLInputElement).maxLength} characters.`;
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch || v.badInput) {
    const { min, max } = field as HTMLInputElement;
    return msg.msgRange ?? `Please enter a whole number from ${min} to ${max}.`;
  }
  return msg.msgRequired ?? "Please check your input.";
}

function validateField(field: Field): boolean {
  // Clear our own flag from the previous check first; otherwise `validity.customError`
  // keeps the field invalid after the participant has fixed it.
  field.setCustomValidity("");
  const message = errorMessage(field);
  field.setCustomValidity(message ?? ""); // makes form.checkValidity() agree with us
  showMessage(field, message);
  return message === null;
}

/** Radios/checkboxes sharing a name are validated (and labeled) together. */
function validateGroup(form: HTMLFormElement, field: Field): void {
  if (field instanceof HTMLInputElement && (field.type === "radio" || field.type === "checkbox")) {
    const group = fields(form).filter((f) => f.name === field.name);
    group.forEach((f) => f.setCustomValidity(""));
    group.forEach(validateField);
  } else {
    validateField(field);
  }
}

function showMessage(field: Field, message: string | null): void {
  const anchor = messageAnchor(field);
  let feedback = anchor.nextElementSibling as HTMLElement | null;
  if (!feedback?.classList.contains("field-error")) {
    feedback = document.createElement("div");
    feedback.className = "field-error";
    feedback.setAttribute("role", "alert");
    anchor.after(feedback);
  }
  feedback.textContent = message ?? "";
  feedback.hidden = message === null;
  field.classList.toggle("is-invalid", message !== null);
  // Enhanced widgets (Tom Select) draw their own box next to the hidden <select>.
  if (anchor !== field) anchor.classList.toggle("is-invalid", message !== null);
}

/** The element after which the message goes. */
function messageAnchor(field: Field): HTMLElement {
  const group = field.closest("fieldset");
  if (
    group &&
    field instanceof HTMLInputElement &&
    (field.type === "radio" || field.type === "checkbox")
  ) {
    return group;
  }
  const enhanced = field.nextElementSibling;
  if (enhanced?.classList.contains("ts-wrapper")) return enhanced as HTMLElement;
  return field;
}

function fields(form: HTMLFormElement): Field[] {
  return [...form.querySelectorAll<Field>(FIELD_SELECTOR)];
}

function asField(target: EventTarget | null): Field | null {
  return target instanceof HTMLElement && target.matches(FIELD_SELECTOR) ? (target as Field) : null;
}
