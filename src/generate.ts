import fs from "node:fs/promises"
import path from "node:path"
import type { CodegenConfig, Preset, ResolvedConfig } from "./config.js"
import { collectEnums, GENERATED_MARKER, renderEnum } from "./core/enums.js"
import { loadDocument } from "./core/load.js"
import { findDanglingRefs, stripContentTypes, stripPaths } from "./core/strip.js"
import { generateTypes } from "./core/types.js"
import { apiPlatformPreset } from "./presets/apiPlatform.js"
import { openapiPreset } from "./presets/openapi.js"

export interface GeneratedFile {
  /** Absolute path. */
  path: string
  contents: string
}

export interface GenerateResult {
  files: GeneratedFile[]
  /** Enum directory; generated files in it that are missing from `files` are stale. */
  enumDir?: string
}

export interface RunResult {
  /** Files created or changed (in check mode: those that would be). */
  changed: string[]
  /** Stale enum files removed (in check mode: those that would be). */
  removed: string[]
}

const PRESETS: Record<string, Preset> = {
  openapi: openapiPreset,
  "api-platform": apiPlatformPreset,
}

export function resolvePreset(preset: CodegenConfig["preset"]): Preset {
  if (undefined === preset) {
    return openapiPreset
  }

  if ("string" !== typeof preset) {
    return preset
  }

  const found = PRESETS[preset]

  if (!found) {
    throw new Error(`Unknown preset "${preset}". Available: ${Object.keys(PRESETS).join(", ")}.`)
  }

  return found
}

/** Computes everything in memory, without writing anything. */
export async function generate(config: CodegenConfig, cwd = process.cwd()): Promise<GenerateResult> {
  const resolved: ResolvedConfig = { ...config, cwd }
  const preset = resolvePreset(config.preset)
  const context = { config: resolved }
  const outDir = path.resolve(cwd, config.outDir)
  const document = await loadDocument(config.source, cwd)

  stripContentTypes(document, config.strip?.contentTypes ?? [])
  stripPaths(document, config.strip?.paths ?? [])
  await preset.transform?.(document, context)

  const dangling = findDanglingRefs(document)

  if (dangling.length > 0) {
    throw new Error(`Broken references after cleanup: ${dangling.join(", ")}.`)
  }

  const files: GeneratedFile[] = []
  const schemaFile = config.schemaFile ?? "openapi.json"

  if (false !== schemaFile) {
    files.push({ path: path.join(outDir, schemaFile), contents: JSON.stringify(document, null, 2) + "\n" })
  }

  if (false !== config.types) {
    files.push({
      path: path.join(outDir, config.types?.fileName ?? "api-schema.ts"),
      contents: await generateTypes(document, config.types?.options),
    })
  }

  if (false === config.enums) {
    return { files }
  }

  const enumDir = path.join(outDir, config.enums?.dir ?? "enums")
  let enums = collectEnums(document, { inline: config.enums?.inline })
  enums = (await preset.enums?.(document, enums, context)) ?? enums

  for (const enumDefinition of enums) {
    files.push({
      path: path.join(enumDir, `${enumDefinition.name}.ts`),
      contents: renderEnum(enumDefinition, { asConst: config.enums?.asConst }),
    })
  }

  return { files, enumDir }
}

/** Writes what changed and removes vanished enums; in check mode, only lists them. */
export async function writeResult(result: GenerateResult, options: { check?: boolean } = {}): Promise<RunResult> {
  const changed: string[] = []

  for (const file of result.files) {
    if ((await readOrNull(file.path)) === file.contents) {
      continue
    }

    changed.push(file.path)

    if (!options.check) {
      await fs.mkdir(path.dirname(file.path), { recursive: true })
      await fs.writeFile(file.path, file.contents, "utf8")
    }
  }

  const removed = result.enumDir ? await findStaleEnumFiles(result.enumDir, result.files) : []

  if (!options.check) {
    await Promise.all(removed.map((file) => fs.unlink(file)))
  }

  return { changed, removed }
}

export async function run(config: CodegenConfig, options: { cwd?: string; check?: boolean } = {}): Promise<RunResult> {
  return writeResult(await generate(config, options.cwd), options)
}

/**
 * Files of the enum directory that we generated ourselves — carrying our
 * marker, or the legacy "Generated - DO NOT EDIT" one — and no longer do.
 * A hand-written file is never touched.
 */
async function findStaleEnumFiles(enumDir: string, files: GeneratedFile[]): Promise<string[]> {
  const kept = new Set(files.map((file) => file.path))
  const entries = await fs.readdir(enumDir, { withFileTypes: true }).catch(() => [])
  const stale: string[] = []

  for (const entry of entries) {
    const file = path.join(enumDir, entry.name)

    if (!entry.isFile() || !entry.name.endsWith(".ts") || kept.has(file)) {
      continue
    }

    const head = (await fs.readFile(file, "utf8")).slice(0, 300)

    if (head.includes(GENERATED_MARKER) || head.includes("Generated - DO NOT EDIT")) {
      stale.push(file)
    }
  }

  return stale.sort()
}

async function readOrNull(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8")
  } catch {
    return null
  }
}
