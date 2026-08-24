import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document as XmlDocument, Element as XmlElement, Node as XmlNode } from "@xmldom/xmldom";
import { DocumentError } from "../common/errors";

export type { XmlDocument, XmlElement, XmlNode };

/** An XML part inside the .docx zip that can hold user-visible text. */
export interface DocxPart {
  path: string;
  doc: XmlDocument;
  /** `doc.documentElement`, proven non-null at parse time so callers needn't re-check. */
  root: XmlElement;
}

export interface ParsedDocx {
  zip: JSZip;
  parts: DocxPart[];
  /** Every entry name in the original archive, used to prove nothing was dropped. */
  entryNames: string[];
}

/**
 * Parts that carry readable text. Everything else in the archive — styles, numbering,
 * themes, images, relationships, settings — is passed through byte-for-byte.
 */
const TEXT_PART = /^word\/(document\d*|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

export async function parseDocx(buffer: Buffer | Uint8Array): Promise<ParsedDocx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (error) {
    throw new DocumentError(
      "invalid-docx",
      `This file is not a readable .docx archive: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const entryNames = Object.keys(zip.files);

  // A real .docx always has these. Their absence usually means a .doc renamed to .docx.
  if (!entryNames.includes("word/document.xml") || !entryNames.includes("[Content_Types].xml")) {
    throw new DocumentError(
      "invalid-docx",
      "This file is missing word/document.xml, so it is not a valid Word (.docx) document. Older .doc files are not supported."
    );
  }

  const parser = new DOMParser({
    onError: (level, message) => {
      // Word writes valid XML; warnings here are noise, but a hard error is worth failing on.
      if (level === "fatalError") {
        throw new DocumentError("invalid-docx", `Corrupted XML inside the .docx: ${message}`);
      }
    },
  });

  const parts: DocxPart[] = [];
  for (const path of entryNames) {
    if (!TEXT_PART.test(path)) continue;
    const xml = await zip.files[path].async("string");
    const doc = parser.parseFromString(xml, "text/xml");
    if (!doc?.documentElement) {
      throw new DocumentError("invalid-docx", `Could not parse ${path} inside the .docx.`);
    }
    parts.push({ path, doc, root: doc.documentElement });
  }

  if (parts.length === 0) {
    throw new DocumentError("invalid-docx", "The .docx contains no readable document parts.");
  }

  return { zip, parts, entryNames };
}

/** Write the edited parts back and re-zip. Untouched entries keep their original bytes. */
export async function serializeDocx(parsed: ParsedDocx): Promise<Buffer> {
  const serializer = new XMLSerializer();

  for (const part of parsed.parts) {
    parsed.zip.file(part.path, serializer.serializeToString(part.doc));
  }

  return parsed.zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    // Word requires this part to be stored first.
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function isElementNode(node: XmlNode | null): node is XmlElement {
  return node !== null && node.nodeType === 1;
}

/** Nearest ancestor (or self) with the given prefixed tag name. */
export function closest(node: XmlNode | null, tagName: string): XmlElement | null {
  let current: XmlNode | null = node;
  while (current) {
    if (isElementNode(current) && current.nodeName === tagName) return current;
    current = current.parentNode;
  }
  return null;
}

export function elementsByTag(root: XmlDocument | XmlElement, tagName: string): XmlElement[] {
  const list = root.getElementsByTagName(tagName);
  const out: XmlElement[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item) out.push(item);
  }
  return out;
}

export function hasDescendant(element: XmlElement, tagName: string): boolean {
  return element.getElementsByTagName(tagName).length > 0;
}
