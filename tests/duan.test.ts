import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChart, type BirthInput } from '../src/core/chart.ts'
import { checkEvents, duanChart, duanDaYun, duanLiuNian, duanToText, resolve, type Override, type VerifiedEvent } from '../src/core/duan.ts'
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

test('人工设定：燥湿土分开取值，断盘按设定推演并附模型原判对照', () => {
  const c = buildChart({ ...base, year: 1954, month: 3, day: 19, hour: 8 }) // 甲午 丁卯 甲戌 戊辰
  const ov: Override = { verdict: '身强', bingYao: '病在火与燥土，药为金水', level: { 木: '忌', 火: '忌', 燥土: '忌', 湿土: '平', 金: '用', 水: '喜' } }
  const { xj } = resolve(c, ov)
  assert.equal(xj.mode, '人工')
  assert.equal(xj.char('戌'), '忌')
  assert.equal(xj.char('辰'), '平')
  assert.equal(xj.char('庚'), '用')
  assert.equal(xj.group['官杀'], '用')
  const d = duanChart(c, ov)
  assert.match(d.headline, /日主身强，以金为用神（按你的设定）/)
  const zl = d.zonglun.map((l) => l.text).join('\n')
  assert.match(zl, /喜忌（你的设定）.*燥土为忌神.*湿土为闲神/)
  assert.match(zl, /模型原判：日主偏弱/)
  assert.match(zl, /你判定为身强（模型按计数为偏弱/)
  assert.ok(!zl.includes('得令却偏弱'), '已人工指定旺衰时不再提示模型的矛盾')
  assert.match(zl, /格局与扶抑一致/) // 身强 + 金为用，阳刃格用官杀
  // 同一步运，设定与模型结论可以不同
  const dy = c.daYun.find((x) => x.gan === '辛' || x.gan === '庚')!
  assert.notEqual(duanDaYun(c, dy, ov).label, duanDaYun(c, dy).label)
})

test('应期规则：流年合日主、子女星透干、天干合化', () => {
  const c = buildChart(base) // 乙丑 己卯 甲辰 己巳，男命，甲日卯月
  const years = c.daYun.flatMap((dy) => dy.liuNian.map((n) => ({ dy, n })))
  const pick = (g: string, a: number, b: number) => years.find(({ n }) => n.ganZhi[0] === g && n.age >= a && n.age <= b)!
  const ji = pick('己', 20, 50)
  assert.ok(duanLiuNian(c, ji.dy, ji.n.year, ji.n.ganZhi).lines.some((l) => l.text.includes('合日主甲')))
  const geng = pick('庚', 20, 50)
  assert.ok(duanLiuNian(c, geng.dy, geng.n.year, geng.n.ganZhi).lines.some((l) => l.text.includes('子女星（七杀）透干')))
  // 甲午 丁卯 甲戌 戊辰：壬年与月干丁相合，卯月木旺，合而化木
  const c2 = buildChart({ ...base, year: 1954, month: 3, day: 19, hour: 8 })
  const ren = c2.daYun.flatMap((dy) => dy.liuNian.map((n) => ({ dy, n }))).find(({ n }) => n.ganZhi[0] === '壬')!
  assert.ok(duanLiuNian(c2, ren.dy, ren.n.year, ren.n.ganZhi).lines.some((l) => l.text.includes('合而化木')))
})

test('已验证事件：分别给出模型与设定的吻合度，起运前的年份不评', () => {
  const c = buildChart(base)
  const dy = c.daYun[2]
  const n = dy.liuNian[0]
  const ev: VerifiedEvent[] = [
    { id: 'a', year: n.year, tone: '吉', text: '测试事件' },
    { id: 'b', year: c.daYun[0].startYear - 1, tone: '凶', text: '起运前' },
  ]
  const ov: Override = { level: { 木: '用', 火: '喜', 燥土: '喜', 湿土: '喜', 金: '忌', 水: '喜' } }
  const r = checkEvents(c, ev, ov)
  assert.equal(r[0].dayun, '起运前')
  assert.equal(r[0].fitModel, '—')
  assert.equal(r[1].ganZhi, n.ganZhi)
  assert.ok(['✓', '△', '✗'].includes(r[1].fitModel))
  assert.ok(r[1].mine && ['✓', '△', '✗'].includes(r[1].fitMine!))
})
