import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChart, type BirthInput } from '../src/core/chart.ts'
import { duanChart, duanDaYun, duanLiuNian, duanToText } from '../src/core/duan.ts'

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
