import type { OpenApiDocument } from "../config.js"

/** Removes the given content types everywhere, and the `content` objects left empty. */
export function stripContentTypes(document: OpenApiDocument, contentTypes: string[]): void {
  if (0 === contentTypes.length) {
    return
  }

  walk(document, (node) => {
    const content = node.content

    if (!content || "object" !== typeof content || Array.isArray(content)) {
      return
    }

    for (const contentType of contentTypes) {
      delete content[contentType]
    }

    if (0 === Object.keys(content).length) {
      delete node.content
    }
  })
}

export function stripPaths(document: OpenApiDocument, patterns: (string | RegExp)[]): void {
  if (0 === patterns.length || !document.paths) {
    return
  }

  for (const key of Object.keys(document.paths)) {
    if (patterns.some((pattern) => ("string" === typeof pattern ? pattern === key : pattern.test(key)))) {
      delete document.paths[key]
    }
  }
}

/** Local `$ref`s that lead nowhere — typically after an overly broad cleanup. */
export function findDanglingRefs(document: OpenApiDocument): string[] {
  const dangling = new Set<string>()

  walk(document, (node) => {
    const ref = node.$ref

    if ("string" === typeof ref && ref.startsWith("#/") && undefined === resolvePointer(document, ref)) {
      dangling.add(ref)
    }
  })

  return [...dangling].sort()
}

function resolvePointer(document: OpenApiDocument, ref: string): unknown {
  return ref
    .slice(2)
    .split("/")
    .map((segment) => decodeURIComponent(segment).replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>(
      (node, segment) => (node && "object" === typeof node ? (node as Record<string, unknown>)[segment] : undefined),
      document,
    )
}

export function walk(node: unknown, visit: (node: Record<string, any>) => void): void {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit))

    return
  }

  if (null === node || "object" !== typeof node) {
    return
  }

  visit(node as Record<string, any>)
  Object.values(node).forEach((child) => walk(child, visit))
}
