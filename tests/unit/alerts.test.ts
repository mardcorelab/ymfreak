import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAlert, whatsappLink } from "../../src/lib/alerts";

test("WhatsApp links add the Dominican country code to 10-digit numbers", () => {
  assert.equal(whatsappLink("(809) 555-1234"), "https://wa.me/18095551234");
  assert.equal(whatsappLink("+1 829 555 1234"), "https://wa.me/18295551234");
  assert.equal(whatsappLink("+34 612 345 678"), "https://wa.me/34612345678");
  assert.equal(whatsappLink("555"), null);
  assert.equal(whatsappLink(null), null);
});

test("lead alerts carry who, what, how to reach them and the conversation link", () => {
  const a = buildAlert(
    { kind: "lead", conversationId: "c1", name: "Ana", email: "ana@example.com", phone: "8095551234", services: "Mezcla + Mastering", artist: "Ana Flow", song: "Fuego", total: "$150" },
    "https://ymfreak.com/",
  );
  assert.match(a.subject, /Cliente interesado: Ana \(Ana Flow\) · Mezcla \+ Mastering/);
  assert.match(a.text, /Canción: Fuego/);
  assert.match(a.text, /Total: \$150/);
  assert.match(a.text, /WhatsApp: https:\/\/wa\.me\/18095551234/);
  assert.match(a.text, /https:\/\/ymfreak\.com\/dashboard\/conversations\/c1/);
  assert.doesNotMatch(a.text, /\n\n\n/);
});

test("booking and payment alerts link to the booking and skip missing fields", () => {
  const b = buildAlert({ kind: "booking", code: "YMF-AB123", bookingId: "b1", name: "Leo", email: "leo@example.com", services: "Mastering", source: "WEB" }, "https://ymfreak.com");
  assert.match(b.subject, /Nueva reserva YMF-AB123: Leo · Mastering/);
  assert.match(b.text, /desde el formulario de la web/);
  assert.doesNotMatch(b.text, /Teléfono|Canción|Total/);
  assert.match(b.text, /\/dashboard\/bookings\/b1$/);
  const p = buildAlert({ kind: "payment", code: "YMF-AB123", bookingId: "b1", name: "Leo", email: "leo@example.com", services: "Mastering", amount: "$35" }, "https://ymfreak.com");
  assert.match(p.subject, /Pago recibido \$35 · YMF-AB123 · Leo/);
  assert.match(p.text, /Leo pagó \$35 en línea/);
});
