// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { errorMessage } from "./form-validation";

function field(html: string) {
  const form = document.createElement("form");
  form.innerHTML = html;
  return form.querySelector<HTMLInputElement>("input, textarea, select")!;
}

describe("errorMessage", () => {
  it("asks for more characters as soon as the text is too short", () => {
    const f = field(`<textarea name="a" required minlength="5"></textarea>`);
    f.value = "abc";
    expect(errorMessage(f)).toBe("Please enter at least 5 characters.");
    f.value = "abcde";
    expect(errorMessage(f)).toBeNull();
  });

  it("uses the generic or custom required message", () => {
    expect(errorMessage(field(`<input name="a" required>`))).toBe("This field is required.");
    expect(errorMessage(field(`<input name="a" required data-msg-required="Age!">`))).toBe("Age!");
  });

  it("explains number ranges", () => {
    const f = field(`<input name="n" type="number" min="1" max="100" required>`);
    f.value = "150";
    expect(errorMessage(f)).toBe("Please enter a whole number from 1 to 100.");
  });
});

describe("live validation", () => {
  it("clears the message once a too-short answer is long enough", async () => {
    const { enableLiveValidation } = await import("./form-validation");
    const form = document.createElement("form");
    form.innerHTML = `<textarea name="a" required minlength="5"></textarea>`;
    document.body.append(form);
    enableLiveValidation(form);
    const field = form.querySelector("textarea")!;
    const type = (text: string) => {
      field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const message = () => {
      const box = field.nextElementSibling as HTMLElement;
      return box.hidden ? null : box.textContent;
    };

    type("I li");
    expect(message()).toBe("Please enter at least 5 characters.");
    type("I like this");
    expect(message()).toBeNull();
    expect(field.checkValidity()).toBe(true);
    form.remove();
  });
});
