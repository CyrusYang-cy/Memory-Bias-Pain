import { describe, expect, it } from "vitest";

import { renderTemplate } from "./template";

describe("renderTemplate", () => {
  it("fills placeholders and escapes HTML", () => {
    expect(renderTemplate("<b>{{ amount }}</b> {{who}}", { amount: "$3.00", who: "<x>" })).toBe(
      "<b>$3.00</b> &lt;x&gt;",
    );
  });

  it("throws on a placeholder without a value", () => {
    expect(() => renderTemplate("{{compensaton}}", { compensation: "$3" })).toThrow(/compensaton/);
  });
});
