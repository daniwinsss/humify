/**
 * A script that runs synchronously while the browser parses the HTML — before the first paint,
 * and before React is involved at all. Used for state that only exists on the client
 * (localStorage, matchMedia) but has to be applied before anything is painted.
 *
 * The `type` swap is deliberate: React warns in development whenever a render produces a
 * `<script>` tag, because scripts inserted through the DOM never execute. Emitting
 * `text/javascript` on the server and `text/plain` on the client silences that while keeping the
 * behaviour we want — the server-rendered tag runs during parsing, and the client-rendered one is
 * inert. `suppressHydrationWarning` covers the resulting type mismatch.
 */
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
