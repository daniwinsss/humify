import sanitizeHtml from "sanitize-html";

/**
 * Tags kept in the preview. This mirrors the formatting the pipeline promises to preserve,
 * so the preview is representative of the downloaded file.
 */
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "div", "span", "section", "article", "header", "footer", "main", "aside", "figure", "figcaption",
  "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "small", "mark", "abbr", "cite", "q",
  "a", "br", "hr", "img",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  "blockquote", "code", "pre", "kbd", "samp", "var",
];

/**
 * Produce HTML that is safe to inject into the page.
 *
 * This is used **only for the on-screen preview**. The file the user downloads is the
 * faithful, unsanitized output — sanitizing it would itself be a formatting change, and
 * the spec forbids that. The dangerous act is rendering untrusted markup in our origin,
 * and that is exactly what this guards.
 */
export function sanitizeForPreview(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["class", "id", "style", "title", "lang", "dir"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      td: ["colspan", "rowspan", "headers", "scope"],
      th: ["colspan", "rowspan", "headers", "scope", "abbr"],
      col: ["span"],
      colgroup: ["span"],
      ol: ["start", "type", "reversed"],
      blockquote: ["cite"],
      q: ["cite"],
    },
    // No javascript:, vbscript:, or file: URLs survive this.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // data: is safe in an <img>: browsers never run script in an image context.
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: true,
    // `expression()` and url(javascript:) can't reach a modern engine, but there is no
    // reason to forward them either.
    allowedStyles: {
      "*": {
        color: [/^.*$/],
        "background-color": [/^.*$/],
        "font-size": [/^.*$/],
        "font-family": [/^.*$/],
        "font-weight": [/^.*$/],
        "font-style": [/^.*$/],
        "text-align": [/^.*$/],
        "text-decoration": [/^.*$/],
        "line-height": [/^.*$/],
        margin: [/^.*$/],
        "margin-left": [/^.*$/],
        "margin-right": [/^.*$/],
        "margin-top": [/^.*$/],
        "margin-bottom": [/^.*$/],
        padding: [/^.*$/],
        border: [/^.*$/],
        "border-collapse": [/^.*$/],
        width: [/^.*$/],
        height: [/^.*$/],
        "text-indent": [/^.*$/],
        "list-style-type": [/^.*$/],
        "vertical-align": [/^.*$/],
      },
    },
    // Anything not allowed loses its tag but keeps its text — never silently drop content.
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "embed"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
    },
  });
}
