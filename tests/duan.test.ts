import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChart, type BirthInput } from '../src/core/chart.ts'
import { duanChart, duanDaYun, duanLiuNian, duanToText } from '../src/core/duan.ts'
import { analyzeStrength } from '../src/core/lifa.ts'

const base: BirthInput = { name: '', gender: 1, calendar: 'solar', year: 1985, month: 3, day: 6, hour: 10, minute: 0, useTrueSolar: false, lng: 120, sect: 1 }

test('甲木生卯月 → 阳刃格，总论开头符合“乾造，甲木日主，生于卯月”', () => {
  const c = buildChart(base) // 乙丑 己卯 甲辰 己巳
  const d = duanChart(c)
  assert.match(d.headline, /^乾造，甲木日主，生于卯月.*阳刃格/)
  assert.deepEqual(d.sections.map((s) => s.title), ['性格', '财富', '事业官运', '婚姻感情', '子女', '六亲', '健康养生'])
})

test('批量盘面：断盘、大运、流年全流程不报错，措辞符合性别与年龄', () => {
  for (let i = 0; i < 120; i++) {
    const gender = (i % 2) as 0 | 1
    const c = buildChart({ ...base, gender, year: 1940 + (i % 70), month: (i % 12) + 1, day: (i % 28) + 1, hour: i % 24 })
    const d = duanChart(c)
    const text = duanToText(c, d)
    assert.ok(!text.includes('undefined') && !text.includes('NaN'), text)
    for (const dy of c.daYun) {
      const y = duanDaYun(c, dy)
      const all = y.lines.map((l) => l.text).join('')
      if (dy.startAge + 4 < 16) assert.ok(!all.includes('升迁') && !all.includes('感情机会'), all)
      for (const n of dy.liuNian) {
        const ly = duanLiuNian(c, dy, n.year, n.ganZhi)
        assert.ok(ly.lines.length >= 3)
        assert.ok(ly.lines[0].text.startsWith(`虚岁 ${n.age}`), ly.lines[0].text)
      }
    }
    if (gender === 0) assert.ok(!text.includes('男命'), '女命不应出现男命断语')
  }
})

// 甲木生卯月却偏弱：断语要讲清“为什么”，且格局与扶抑不能自相矛盾
test('甲午 丁卯 甲戌 戊辰：月令合绊、得令却弱的提示、阳刃格与扶抑的取舍说明', () => {
  const c = buildChart({ ...base, year: 1954, month: 3, day: 19, hour: 8 })
  assert.equal((['year', 'month', 'day', 'time'] as const).map((k) => c.pillars[k].gan + c.pillars[k].zhi).join(' '), '甲午 丁卯 甲戌 戊辰')
  const st = analyzeStrength(c)
  // 卯戌紧贴六合：月支乙 3×0.7=2.1，日支戌中戊 0.9×0.7=0.63
  assert.equal(st.items.find((i) => i.pos === '月支卯·乙')!.weight, 2.1)
  assert.equal(st.items.find((i) => i.pos === '日支戌·戊')!.weight, 0.63)
  assert.equal(st.adjustments.length, 1)
  assert.match(st.adjustments[0], /卯.*戌.*合/)
  assert.ok(st.lingConflict)
  assert.ok(st.ratio < 0.45, `ratio=${st.ratio}`)

  const d = duanChart(c)
  const zl = d.zonglun.map((l) => l.text).join('\n')
  assert.match(zl, /得令却偏弱/)
  assert.match(zl, /月令卯被六合绊住/)
  assert.match(zl, /阳刃格本喜官杀制刃.*官杀反为忌神/)
  const guan = d.sections.find((s) => s.key === 'guan')!.lines.map((l) => l.text).join('')
  assert.ok(!guan.includes('喜官杀约束成就权威'), guan)
})

test('月令无六合时不做合绊修正；格局与扶抑一致时如实说明', () => {
  const c = buildChart(base) // 乙丑 己卯 甲辰 己巳：卯与丑、辰都不六合
  const st = analyzeStrength(c)
  assert.equal(st.adjustments.length, 0)
  assert.ok(st.items.every((i) => !i.note))
  const zl = duanChart(c).zonglun.map((l) => l.text).join('\n')
  assert.match(zl, /格局与扶抑一致/)
  assert.ok(!zl.includes('得令却偏弱'))
})
