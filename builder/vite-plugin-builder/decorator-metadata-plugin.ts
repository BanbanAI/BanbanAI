import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import ts from 'typescript'
import type { Plugin as EsbuildPlugin } from 'esbuild'

const lineDecoratorPattern = /(^|[\r\n]\s*)@[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*(?:\(|$)/
const parameterDecoratorPattern = /[(,]\s*@[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*(?:\(|$)/

function hasDecoratorSyntax(source: string) {
  return lineDecoratorPattern.test(source) || parameterDecoratorPattern.test(source)
}

function parseTsConfig(tsconfigPath?: string, cwd = process.cwd()) {
  const fileName = ts.findConfigFile(cwd, ts.sys.fileExists, tsconfigPath || join(cwd, 'tsconfig.json'))
  if (!fileName) {
    throw new Error(`failed to open '${tsconfigPath || 'tsconfig.json'}'`)
  }

  const text = ts.sys.readFile(fileName)
  if (text === undefined) {
    throw new Error(`failed to read '${fileName}'`)
  }

  const result = ts.parseConfigFileTextToJson(fileName, text)
  if (result.error) {
    throw new Error(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'))
  }

  const parsed = ts.parseJsonConfigFileContent(result.config, ts.sys, dirname(fileName))
  if (parsed.options.sourceMap) {
    parsed.options.sourceMap = false
    parsed.options.inlineSources = true
    parsed.options.inlineSourceMap = true
  }

  return parsed
}

export function esbuildDecoratorMetadataPlugin(options: {
  cwd?: string
  tsconfig?: string
  tsx?: boolean
} = {}): EsbuildPlugin {
  return {
    name: 'decorator-metadata',
    setup(build) {
      const cwd = options.cwd || process.cwd()
      const filter = options.tsx === false ? /\.ts$/ : /\.tsx?$/
      let parsedTsConfig: ts.ParsedCommandLine | null = null

      build.onLoad({ filter }, async (args) => {
        if (!parsedTsConfig) {
          parsedTsConfig = parseTsConfig(options.tsconfig || build.initialOptions.tsconfig, cwd)
        }

        if (!parsedTsConfig.options.emitDecoratorMetadata) {
          return
        }

        const source = await fs.readFile(args.path, 'utf8')
        if (!hasDecoratorSyntax(source)) {
          return
        }

        const transpiled = ts.transpileModule(source, {
          compilerOptions: parsedTsConfig.options,
          fileName: args.path,
        })

        return {
          contents: transpiled.outputText,
        }
      })
    },
  }
}
