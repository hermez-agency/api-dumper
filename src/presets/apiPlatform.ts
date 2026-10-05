import type { EnumDefinition, OpenApiDocument, Preset, PresetContext } from "../config.js"
import { mergeEnums, toTypeName } from "../core/enums.js"
import { isUrl } from "../core/load.js"

/** Suffix of the schemas API Platform derives per format (`Animal.csv`, `Animal.csv-read`, `Animal.csv_noid`). */
const FORMAT_BY_CONTENT_TYPE: Record<string, string> = {
  "text/csv": "csv",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/x-yaml": "yaml",
  "application/yaml": "yaml",
  "text/html": "html",
  "application/vnd.api+json": "jsonapi",
  "application/hal+json": "jsonhal",
  "application/graphql-response+json": "graphql",
}

/**
 * API Platform / JSON-LD:
 * - a stripped content type also takes away the schemas of its format;
 * - enums exposed as resources get their IRIs (`XxxApiEnum`), either from
 *   `x-enum-iris` in the document or by fetching their Hydra collections.
 */
export const apiPlatformPreset: Preset = {
  name: "api-platform",

  transform(document, { config }) {
    const formats = (config.strip?.contentTypes ?? [])
      .map((contentType) => FORMAT_BY_CONTENT_TYPE[contentType])
      .filter(Boolean)

    stripFormatSchemas(document, formats)
  },

  async enums(document, enums, context) {
    const collections = context.config.apiPlatform?.collections

    if (!collections || 0 === collections.paths.length) {
      return enums
    }

    const fetched = await Promise.all(collections.paths.map((path) => fetchEnumCollection(path, context)))

    return mergeEnums([...enums, ...fetched])
  },
}

export function stripFormatSchemas(document: OpenApiDocument, formats: string[]): void {
  const schemas = document.components?.schemas

  if (!schemas || 0 === formats.length) {
    return
  }

  const pattern = new RegExp(`\\.(${formats.join("|")})([-_].*)?$`)

  for (const key of Object.keys(schemas)) {
    if (pattern.test(key)) {
      delete schemas[key]
    }
  }
}

interface HydraMember {
  "@id"?: string
  "@type"?: string
  value?: string | number
}

async function fetchEnumCollection(path: string, { config }: PresetContext): Promise<EnumDefinition> {
  const { host, headers } = config.apiPlatform!.collections!
  const base = host ?? (isUrl(config.source) ? new URL(config.source).origin : undefined)

  if (!base) {
    throw new Error("apiPlatform.collections.host is required when source is not a URL.")
  }

  const url = new URL(path, base).toString()
  const response = await fetch(url, { headers: { accept: "application/ld+json", ...headers } })

  if (!response.ok) {
    throw new Error(`GET ${url} responded ${response.status} ${response.statusText}.`)
  }

  const data = (await response.json()) as Record<string, any>
  const members: HydraMember[] = data.member ?? data["hydra:member"] ?? []
  const name = nameFromContext(data["@context"]) ?? members[0]?.["@type"]

  if (!name) {
    throw new Error(`${url}: cannot name the enum (no @context nor @type).`)
  }

  const values = members.map((member, index) => {
    if (undefined === member.value) {
      throw new Error(`${url}: member ${index} has no "value".`)
    }

    return member.value
  })
  const keys = values.map(String)

  return {
    name: toTypeName(name),
    values,
    keys,
    iris: Object.fromEntries(members.flatMap((member, index) => (member["@id"] ? [[keys[index], member["@id"]]] : []))),
    origin: url,
  }
}

/** `/api/contexts/Gender` → `Gender`. */
function nameFromContext(context: unknown): string | undefined {
  return "string" === typeof context ? context.split("/").filter(Boolean).pop() : undefined
}
