import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePlannedStay } from "../src/domain/budget.js";
import { renderOnboarding } from "../src/ui/onboarding.js";
import { closeStayDialog, openStayDialog, renderStayDialog } from "../src/ui/stay-dialog.js";

test("new plans require a chosen budget and connect its guidance and errors", () => {
  const fresh = renderOnboarding({ defaultYear: "2026" });
  const invalid = renderOnboarding({
    defaultYear: "2026",
    fieldErrors: { budgetDays: "Ange din personliga dagbudget." }
  });
  const existing = renderOnboarding({
    defaultYear: "2026",
    profile: { budgetDays: 42 },
    editing: true
  });

  assert.match(fresh, /name="budgetDays"[^>]*value=""[^>]*aria-describedby="budgetDays-hint"/);
  assert.match(invalid, /name="budgetDays"[^>]*aria-invalid="true"[^>]*aria-describedby="budgetDays-hint budgetDays-error"/);
  assert.match(existing, /name="budgetDays"[^>]*value="42"/);
});

test("preview distinguishes full length, overlap and dates outside the budget period", () => {
  const values = { arrivalDate: "2026-07-31", departureDate: "2026-08-06", status: "planned" };
  const profile = { budgetDays: 4, periodStart: "2026-08-02", periodEnd: "2026-08-06" };
  const preview = evaluatePlannedStay(profile, [{
    arrivalDate: "2026-08-02", departureDate: "2026-08-03", status: "actual"
  }], values);
  const html = renderStayDialog({ values, preview: { ...preview, budgetDays: profile.budgetDays } });

  assert.match(html, /Vistelsen är 7 dagar/);
  assert.match(html, /3 nya unika dagar inom budgetperioden/);
  assert.match(html, /2 dagar överlappar/);
  assert.match(html, /2 dagar ligger utanför budgetperioden/);
  assert.match(html, /6 augusti 2026/);
  assert.match(html, /personliga budget/);
  assert.match(html, /1 dag över din personliga budget/);
  const collapsedDetails = html.indexOf('<details class="stay-preview__details">');
  assert.ok(collapsedDetails > html.indexOf("1 dag över din personliga budget"));
  assert.ok(collapsedDetails > html.indexOf("2 dagar ligger utanför budgetperioden"));
  assert.match(html, /<summary>Visa beräkning<\/summary>/);
});

test("save actions stay outside the scrolling fields while belonging to the stay form", () => {
  const html = renderStayDialog({ values: {}, mode: "edit" });
  assert.match(html, /<form data-form="stay" novalidate><div class="stay-dialog__body">/);
  assert.match(html, /<\/div><footer class="stay-dialog__actions"><div class="form-actions">/);
  assert.match(html, /type="submit">Spara ändringar/);
  assert.match(html, /<\/footer><\/form><\/section>$/);
});

test("overlapping calendar stays offer separate escaped choices and an add action", () => {
  const html = renderStayDialog({ choices: [
    { id: 'first"<>', arrivalDate: "2026-08-01", departureDate: "2026-08-03", status: "actual" },
    { id: "second", arrivalDate: "2026-08-02", departureDate: "2026-08-06", status: "planned" }
  ] });

  assert.match(html, /id="stay-dialog-title">Välj vistelse/);
  assert.equal((html.match(/data-action="choose-stay"/g) ?? []).length, 2);
  assert.match(html, /data-stay-id="first&quot;&lt;&gt;"/);
  assert.match(html, /1 augusti 2026–3 augusti 2026/);
  assert.match(html, /Faktisk/);
  assert.match(html, /Planerad/);
  assert.match(html, /data-action="new-stay-on-date"/);
  assert.match(html, /data-action="cancel-stay"/);
  assert.doesNotMatch(html, /<form/);
});

test("chooser focuses its first stay and restores the original opener on close", () => {
  let selected = null;
  let focused = false;
  let restored = false;
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    querySelector(selector) {
      selected = selector;
      return { focus() { focused = true; } };
    }
  };
  openStayDialog(dialog, { choices: [{
    id: "one", arrivalDate: "2026-08-01", departureDate: "2026-08-02", status: "actual"
  }] }, { isConnected: true, focus() { restored = true; } });
  assert.equal(selected, '[data-action="choose-stay"]');
  assert.equal(focused, true);
  closeStayDialog(dialog);
  assert.equal(restored, true);
});
