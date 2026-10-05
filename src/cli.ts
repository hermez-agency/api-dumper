#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { createJiti } from "jiti"
import type { CodegenConfig } from "./config.js"
import { run } from "./generate.js"

const CONFIG_FILES = [
  "api-dumper.config.ts",
  "api-dumper.config.mts",
  "api-dumper.config.js",
  "api-dumper.config.mjs",
  "api-dumper.config.json",
]

const HELP = `Usage: api-dumper [--config <file>] [--check]

  -c, --config  Configuration file (default: ${CONFIG_FILES[0]} and variants)
      --check   Write nothing; fail if the generated files are out of date
  -h, --help    Show this help`

async function main(argv: string[]): Promise<number> {
  let configArg: string | undefined
  let check = false

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]

    if ("-h" === arg || "--help" === arg) {
      console.info(HELP)

      return 0
    } else if ("--check" === arg) {
      check = true
    } else if ("-c" === arg || "--config" === arg) {
      configArg = argv[++index]
    } else if (arg.startsWith("--config=")) {
      configArg = arg.slice("--config=".length)
    } else {
      console.error(`Unknown option: ${arg}\n\n${HELP}`)

      return 2
    }
  }

  const configPath = configArg
    ? path.resolve(configArg)
    : CONFIG_FILES.map((file) => path.resolve(file)).find((file) => fs.existsSync(file))

  if (!configPath || !fs.existsSync(configPath)) {
    console.error(`Configuration not found${configArg ? `: ${configArg}` : ""}.\n\n${HELP}`)

    return 2
  }

  const jiti = createJiti(import.meta.url)
  const config = await jiti.import<CodegenConfig>(configPath, { default: true })
  const cwd = path.dirname(configPath)
  const { changed, removed } = await run(config, { cwd, check })
  const relative = (file: string) => path.relative(process.cwd(), file)

  if (check) {
    if (0 === changed.length + removed.length) {
      console.info("✔ Generated files are up to date.")

      return 0
    }

    changed.forEach((file) => console.error(`✘ out of date: ${relative(file)}`))
    removed.forEach((file) => console.error(`✘ stale: ${relative(file)}`))
    console.error("\nRun api-dumper to update them.")

    return 1
  }

  changed.forEach((file) => console.info(`✔ ${relative(file)}`))
  removed.forEach((file) => console.info(`✘ removed: ${relative(file)}`))
  console.info(0 === changed.length + removed.length ? "Nothing to change." : "Done.")

  return 0
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  },
)
