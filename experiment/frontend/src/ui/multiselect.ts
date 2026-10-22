/**
 * Turns `<select multiple data-enhance="multiselect">` into a searchable dropdown with
 * checkboxes, showing the chosen options as removable tags (Tom Select, Bootstrap 5 theme).
 * The original <select> stays in the form and holds the values, so form submission,
 * validation and data saving work exactly as for a plain <select multiple> (Tom Select
 * fires the select's normal `change` event).
 */
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.bootstrap5.css";

export function enhanceMultiSelects(root: ParentNode): void {
  for (const select of root.querySelectorAll<HTMLSelectElement>(
    'select[multiple][data-enhance="multiselect"]',
  )) {
    const widget = new TomSelect(select, {
      plugins: ["remove_button", "checkbox_options"],
      placeholder: select.dataset.placeholder ?? "Select or type to search…",
      hidePlaceholder: true,
      closeAfterSelect: false,
      maxOptions: undefined,
      create: false,
    });
    // Typing filters the list; clear it after a choice so the full list shows again.
    widget.on("item_add", () => {
      widget.setTextboxValue("");
      widget.refreshOptions(false);
    });
  }
}
