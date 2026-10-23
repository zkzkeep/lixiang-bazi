// 本地存储：所有数据只存在用户自己的浏览器里，不上传任何服务器
import type { BirthInput } from './core/chart.ts'
import type { Override, VerifiedEvent } from './core/duan.ts'

export interface CaseItem {
  id: string
  input: BirthInput
  /** 先断后验笔记 */
  note: string
  /** 经过验证的人工喜忌设定 */
  override?: Override
  /** 已验证事件 */
  events?: VerifiedEvent[]
  createdAt: number
  updatedAt: number
}

export interface LessonProgress {
  best: number
  total: number
  at: number
}

export interface DrillStats {
  [kind: string]: { right: number; total: number }
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* 隐私模式等情况下写不进去，忽略即可 */
  }
}

const K = { cases: 'lx.cases', progress: 'lx.progress', drills: 'lx.drills', current: 'lx.current', blind: 'lx.blind' }

export const store = {
  getCases: () => read<CaseItem[]>(K.cases, []),
  saveCase(c: CaseItem) {
    const all = store.getCases().filter((x) => x.id !== c.id)
    write(K.cases, [c, ...all])
  },
  deleteCase(id: string) {
    write(K.cases, store.getCases().filter((x) => x.id !== id))
  },
  importCases(list: CaseItem[]) {
    const map = new Map(store.getCases().map((c) => [c.id, c]))
    list.forEach((c) => map.set(c.id, c))
    write(K.cases, [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt))
  },

  getProgress: () => read<Record<string, LessonProgress>>(K.progress, {}),
  setProgress(id: string, right: number, total: number) {
    const all = store.getProgress()
    const prev = all[id]
    if (!prev || right >= prev.best) all[id] = { best: right, total, at: Date.now() }
    write(K.progress, all)
  },

  getDrills: () => read<DrillStats>(K.drills, {}),
  addDrill(kind: string, ok: boolean) {
    const all = store.getDrills()
    const s = all[kind] ?? { right: 0, total: 0 }
    all[kind] = { right: s.right + (ok ? 1 : 0), total: s.total + 1 }
    write(K.drills, all)
  },

  /** 当前正在看的盘：caseId 为空表示还没保存 */
  getCurrent: () => read<Current | null>(K.current, null),
  setCurrent: (v: Current) => write(K.current, v),

  /** 先断后验模式：开启后理法/象法分析默认遮住 */
  getBlind: () => read<boolean>(K.blind, false),
  setBlind: (v: boolean) => write(K.blind, v),
}

export interface Current {
  input: BirthInput
  caseId?: string
  override?: Override
  events?: VerifiedEvent[]
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
