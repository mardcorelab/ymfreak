/** Opens the assistant from anywhere on the site, optionally with a message ready to send. */
export const OPEN_EVENT = "ymf:agent-open";

export function openAssistant(prompt?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { prompt } }));
}
