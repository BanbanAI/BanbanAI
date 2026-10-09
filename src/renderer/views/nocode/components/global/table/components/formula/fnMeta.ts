import { StateField } from "@codemirror/state"
import { scanFormulaJump, scanFunctions } from "./scanFormula"
import { unique } from "@common/utils/unique"
import { FnMeta } from "@common/utils"

export const fnMetaField = StateField.define<FnMeta[]>({

  create() {
    return []
  },

  update(oldMetas, tr) {
    if (!tr.docChanged) return oldMetas

    const doc = tr.state.doc.toString()

    // 先把旧 meta 位置映射到新文档
    const mappedOld = oldMetas.map(meta => ({
      ...meta,
      nameFrom: tr.changes.mapPos(meta.nameFrom),
      nameTo: tr.changes.mapPos(meta.nameTo)
    }))

    // 全量扫描新文档结构（不带 fnId）
    const newStructure = scanFunctions(doc)

    const result: FnMeta[] = []

    // 建立旧 meta 快速索引（按 name 分组）
    const oldMap = new Map<string, FnMeta[]>()

    for (const meta of mappedOld) {
      if (!oldMap.has(meta.name)) {
        oldMap.set(meta.name, [])
      }
      oldMap.get(meta.name)!.push(meta)
    }

    // 遍历新结构，尝试复用 fnId
    for (const newMeta of newStructure) {

      const candidates = oldMap.get(newMeta.name)

      let reused: FnMeta | undefined

      if (candidates) {
        reused = candidates.find(old =>
          old.nameFrom === newMeta.nameFrom
        )
      }

      if (reused) {
        result.push({
          ...newMeta,
          fnId: reused.fnId
        })
      } else {
        result.push({
          ...newMeta,
          fnId: unique()
        })
      }
    }

    return result
  }
})

export function parseFnMetas(formula: string): FnMeta[] {
  const result: FnMeta[] = []

  let buffer = ""
  let bufferStart = -1

  scanFormulaJump(formula, {
    onChar(ch, ctx) {
      if (ctx.inString || ctx.inBracket) {
        buffer = ""
        return
      }

      // 收集函数名
      if (/[a-zA-Z0-9_]/.test(ch)) {
        if (!buffer) bufferStart = ctx.index
        buffer += ch
        return
      }

      if (!buffer) return

      const name = buffer
      const nameFrom = bufferStart
      const nameTo = nameFrom + name.length

      let i = nameTo
      let fnId: string | null = null

      // if (formula[i] === "<") {
      //   let j = i + 1
      //   while (j < formula.length && formula[j] !== ">") j++

      //   if (formula[j] === ">") {
      //     const inner = formula.slice(i + 1, j)
      //     if (/^[a-zA-Z0-9_-]+$/.test(inner)) {
      //       fnId = inner
      //       fidFrom = i
      //       fidTo = j + 1
      //       i = j + 1
      //     }
      //   }
      // }

      if (formula[i] === "(") {
        result.push({
          name,
          nameFrom,
          nameTo,
          fnId
        })
      }

      buffer = ""
    }
  })

  return result
}
