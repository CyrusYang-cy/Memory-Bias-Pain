/**
 * Fills `{{name}}` placeholders in an HTML page with HTML-escaped values.
 * A placeholder without a value throws, so typos are caught immediately instead of
 * showing "{{compensaton}}" to participants.
 */
export function renderTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    if (!(name in values)) throw new Error(`Template placeholder {{${name}}} has no value`);
    return escapeHtml(String(values[name]));
  });
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
