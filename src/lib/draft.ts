/**
 * Hand-off of the text a visitor typed into the landing-page hero, so /app opens with it already
 * in the editor instead of an empty box.
 *
 * sessionStorage rather than a query string: the input accepts full essays, which would blow past
 * what a URL can carry, and the draft is unsubmitted user writing that has no business appearing
 * in browser history or a referrer header. It is read once and cleared, so a later reload of /app
 * doesn't resurrect text the user has already moved on from.
 */
const DRAFT_KEY = "humify:draft";

export function saveDraft(text: string): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, text);
  } catch {
    // Private-mode or storage-full: the user just lands on /app with an empty editor.
  }
}

export function takeDraft(): string {
  try {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    return draft ?? "";
  } catch {
    return "";
  }
}
