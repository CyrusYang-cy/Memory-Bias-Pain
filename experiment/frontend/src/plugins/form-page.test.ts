// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { serializeForm } from "./form-page";

describe("serializeForm", () => {
  it("keeps every checked checkbox (v1 lost all but one)", () => {
    const form = document.createElement("form");
    form.innerHTML = `
      <input name="age" value="30">
      <input type="checkbox" name="race" value="East Asian" checked>
      <input type="checkbox" name="race" value="White" checked>
      <input type="checkbox" name="race" value="South Asian">
      <input type="radio" name="consent" value="consent" checked>
      <input type="radio" name="consent" value="reject">`;
    expect(serializeForm(form)).toEqual({
      age: "30",
      race: ["East Asian", "White"],
      consent: "consent",
    });
  });
});

describe("serializeForm with a multi-select", () => {
  it("always gives an array, even with zero or one choice", () => {
    const form = document.createElement("form");
    form.innerHTML = `
      <select name="race" multiple>
        <option selected>White</option><option>East Asian</option>
      </select>
      <select name="none" multiple><option>A</option></select>`;
    expect(serializeForm(form)).toEqual({ race: ["White"], none: [] });
  });
});
