import { parse, parseFragment, serialize, defaultTreeAdapter } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";
import { DocumentError } from "../common/errors";

export type HtmlNode = DefaultTreeAdapterTypes.Node;
export type HtmlElement = DefaultTreeAdapterTypes.Element;
export type HtmlTextNode = DefaultTreeAdapterTypes.TextNode;
export type HtmlParentNode = DefaultTreeAdapterTypes.ParentNode;

export interface ParsedHtml {
  root: HtmlParentNode;
  /**
   * True when the source had no `<html>`/doctype wrapper. Fragments are parsed and
   * serialized as fragments so we don't invent a document shell the user never had.
   */
  isFragment: boolean;
}

const DOCUMENT_SIGNAL = /<!doctype\s|<html[\s>]/i;

export function isElement(node: HtmlNode): node is HtmlElement {
  return defaultTreeAdapter.isElementNode(node);
}

export function isTextNode(node: HtmlNode): node is HtmlTextNode {
  return defaultTreeAdapter.isTextNode(node);
}

export function childNodes(node: HtmlNode): HtmlNode[] {
  return (node as HtmlParentNode).childNodes ?? [];
}

export function getAttribute(element: HtmlElement, name: string): string | null {
  return element.attrs.find((a) => a.name === name)?.value ?? null;
}

/** Depth-first walk over every node beneath `root`, excluding `root` itself. */
export function* walk(root: HtmlNode): Generator<HtmlNode> {
  for (const child of childNodes(root)) {
    yield child;
    yield* walk(child);
  }
}

export function findElement(root: HtmlNode, tagName: string): HtmlElement | null {
  for (const node of walk(root)) {
    if (isElement(node) && node.tagName === tagName) return node;
  }
  return null;
}

export function parseHtml(source: string): ParsedHtml {
  if (source.trim().length === 0) {
    throw new DocumentError("empty-document", "The HTML document is empty.");
  }

  // parse5 is a spec-compliant recovering parser: malformed markup is repaired the same
  // way a browser would repair it, so there is no separate "corrupt HTML" failure path.
  try {
    if (DOCUMENT_SIGNAL.test(source)) {
      return { root: parse(source), isFragment: false };
    }
    return { root: parseFragment(source), isFragment: true };
  } catch (error) {
    throw new DocumentError(
      "malformed-html",
      `The HTML could not be parsed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function serializeHtml(parsed: ParsedHtml): string {
  return serialize(parsed.root);
}

/** The subtree that holds visible content: `<body>` for documents, the root for fragments. */
export function contentRoot(parsed: ParsedHtml): HtmlParentNode {
  if (parsed.isFragment) return parsed.root;
  return findElement(parsed.root, "body") ?? parsed.root;
}
