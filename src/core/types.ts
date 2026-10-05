import openapiTS, { astToString, COMMENT_HEADER, type OpenAPITSOptions } from "openapi-typescript"
import type { OpenApiDocument } from "../config.js"

export async function generateTypes(document: OpenApiDocument, options: OpenAPITSOptions = {}): Promise<string> {
  // openapi-typescript may annotate the document: hand it a copy.
  const ast = await openapiTS(structuredClone(document) as Parameters<typeof openapiTS>[0], {
    silent: true,
    ...options,
  })

  // Same banner as the openapi-typescript CLI, so the output is identical.
  return COMMENT_HEADER + astToString(ast)
}
