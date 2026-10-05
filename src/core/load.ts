import fs from "node:fs/promises"
import path from "node:path"
import YAML from "yaml"
import type { OpenApiDocument } from "../config.js"

export function isUrl(source: string): boolean {
  return /^https?:\/\//i.test(source)
}

export async function loadDocument(source: string, cwd: string): Promise<OpenApiDocument> {
  const text = isUrl(source) ? await fetchText(source) : await fs.readFile(path.resolve(cwd, source), "utf8")
  const document = parse(text, source)

  if ("string" !== typeof document.openapi || !document.openapi.startsWith("3.")) {
    throw new Error(
      `${source} is not an OpenAPI 3.x document` +
        (document.swagger ? " (Swagger 2 is not supported)." : "."),
    )
  }

  return document
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`GET ${url} responded ${response.status} ${response.statusText}.`)
  }

  return response.text()
}

function parse(text: string, source: string): OpenApiDocument {
  try {
    return JSON.parse(text)
  } catch {
    // Not JSON: try YAML, of which JSON is a subset.
  }

  const document = YAML.parse(text)

  if (null === document || "object" !== typeof document) {
    throw new Error(`${source} contains neither usable JSON nor YAML.`)
  }

  return document
}
