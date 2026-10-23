// 把命盘（及附加的大运/流年柱）展开成关系识别用的节点
import { PILLAR_KEYS, type Chart, type Pillar } from './chart.ts'
import type { Node } from './relations.ts'

export function chartNodes(chart: Chart, extra: Pillar[] = []): { gans: Node[]; zhis: Node[] } {
  const ps = [...PILLAR_KEYS.map((k) => chart.pillars[k]), ...extra]
  return {
    gans: ps.map((p) => ({ label: p.label.replace('柱', '') + '干', char: p.gan })),
    zhis: ps.map((p) => ({ label: p.label.replace('柱', '') + '支', char: p.zhi })),
  }
}
