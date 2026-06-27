import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Info, CheckSquare, Square, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronRight, X, AlertTriangle, Activity } from 'lucide-react'

// ─────────────────────────────────────────────
// 색상 상수
// ─────────────────────────────────────────────
const C = {
  bg:     '#0a0e14',
  panel:  '#0f1520',
  border: '#1e2d40',
  accent: '#1a73e8',
  orange: '#e8860a',
  green:  '#00c853',
  red:    '#f44336',
  yellow: '#ffd600',
  text:   '#cdd6e0',
  muted:  '#5a7080',
  header: '#0d1b2a',
}

// ─────────────────────────────────────────────
// 도움말 멘트
// ─────────────────────────────────────────────
const HELP = {
  vix: '대중과 반대로 행동하세요. VIX가 30 이상으로 치솟으며 \'극도의 공포\' 구간에 진입할 때는 좋은 주식을 분할 매수할 기회이며, 80에 근접한 \'극도의 탐욕\' 구간에서는 현금을 확보하는 기준이 됩니다.',
  nps: '시장의 가장 큰 고래인 국민연금의 포트폴리오입니다. 매일 새벽 GitHub Actions가 갱신하며, 기관이 장기적으로 모아가는 우량주 수급의 뼈대를 확인하는 용도입니다. 내 포트폴리오가 이들의 방향성과 너무 어긋나지 않는지 점검하세요.',
  credit: '개인들의 \'빚투\' 열기를 보여줍니다. 비율이 전고점을 뚫고 폭발할 때는 단기 꼭지(과열)일 확률이 매우 높으므로 조심해야 합니다. 반대로 반대매매가 터져 신용잔고 비율이 급감하면 시장의 단기 바닥 신호일 수 있습니다.',
  fed: '증시의 기초체력인 금리와 환율입니다. 미 국채 금리와 달러 인덱스가 동시에 치솟을 때는 위험자산(주식)에서 돈이 빠져나가는 신호이므로 주식 비중을 보수적으로 조절하고, 이 지표들이 하향 안정화될 때 적극적으로 매매를 고려하세요.',
  breadth: '시장의 속살을 보는 지표입니다. 지수는 오르는데 정작 신고가 종목 수가 줄어들고 있다면 소수 대형주만 오르는 \'착시 현상\'이며 하락장의 전조일 수 있습니다. 반대로 지수가 지지부진해도 신고가 종목이 늘어난다면 장의 체력이 좋아지고 있다는 뜻입니다.',
}

// ─────────────────────────────────────────────
// Mock 데이터
// ─────────────────────────────────────────────
const VIX_DATA = [
  { date: '06/01', value: 16.2 }, { date: '06/04', value: 17.8 },
  { date: '06/05', value: 21.4 }, { date: '06/06', value: 19.0 },
  { date: '06/07', value: 22.5 }, { date: '06/10', value: 18.3 },
  { date: '06/11', value: 24.1 }, { date: '06/12', value: 26.7 },
  { date: '06/13', value: 28.9 }, { date: '06/14', value: 31.2 },
  { date: '06/17', value: 29.5 }, { date: '06/18', value: 27.1 },
  { date: '06/19', value: 24.8 }, { date: '06/20', value: 22.3 },
  { date: '06/21', value: 20.5 }, { date: '06/24', value: 19.1 },
  { date: '06/25', value: 18.7 }, { date: '06/26', value: 17.9 },
  { date: '06/27', value: 18.2 },
]

const CREDIT_DATA = [
  { date: '01월', ratio: 1.82 }, { date: '02월', ratio: 1.95 },
  { date: '03월', ratio: 2.11 }, { date: '04월', ratio: 2.34 },
  { date: '05월', ratio: 2.58 }, { date: '06월', ratio: 2.71 },
]

const FED_DATA = [
  { date: '06/01', rate: 4.25, dxy: 104.2 },
  { date: '06/07', rate: 4.30, dxy: 104.8 },
  { date: '06/14', rate: 4.28, dxy: 105.1 },
  { date: '06/21', rate: 4.22, dxy: 103.9 },
  { date: '06/27', rate: 4.18, dxy: 103.2 },
]

const BREADTH_DATA = [
  { date: '06/20', highs: 312, lows: 89 },
  { date: '06/21', highs: 287, lows: 102 },
  { date: '06/24', highs: 334, lows: 78 },
  { date: '06/25', highs: 298, lows: 95 },
  { date: '06/26', highs: 321, lows: 83 },
  { date: '06/27', highs: 356, lows: 71 },
]

// 기본 체크리스트 항목
const DEFAULT_CHECKLIST = [
  { id: 'c1', text: '오늘 VIX 수준 확인 (30 이상 = 분할매수 기회)', checked: false },
  { id: 'c2', text: '국민연금 포트 방향성과 내 보유 종목 비교', checked: false },
  { id: 'c3', text: '신용잔고 전고점 대비 위치 확인', checked: false },
  { id: 'c4', text: '미 국채 금리 & 달러인덱스 방향 확인', checked: false },
  { id: 'c5', text: '신고가 종목 수 추세 확인 (이격 여부)', checked: false },
  { id: 'c6', text: '손절 원칙(-8%) 지켰는가?', checked: false },
  { id: 'c7', text: '오늘 매매 전 심리 상태 점검 완료', checked: false },
]

// ─────────────────────────────────────────────
// 유틸 함수
// ─────────────────────────────────────────────
function getVixStatus(val) {
  if (val < 15) return { label: '극도의 탐욕', color: C.red,    badge: 'badge-red' }
  if (val < 20) return { label: '안정',         color: C.green,  badge: 'badge-green' }
  if (val < 30) return { label: '주의',         color: C.yellow, badge: 'badge-yellow' }
  if (val < 40) return { label: '공포',         color: C.orange, badge: 'badge-red' }
  return              { label: '극도의 공포',   color: C.red,    badge: 'badge-red' }
}

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// ─────────────────────────────────────────────
// 도움말 팝오버 컴포넌트
// ─────────────────────────────────────────────
function HelpPopover({ content }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[#5a7080] hover:text-[#1a73e8] transition-colors p-0.5"
        title="해석 가이드"
      >
        <Info size={13} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-6 z-50 w-72 rounded-lg border border-[#1a73e8] bg-[#0f1520] p-3 text-xs leading-relaxed shadow-2xl"
          style={{ color: C.text }}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-[#1a73e8]">💡</span>
            <p>{content}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 text-[#5a7080] hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 위젯 공통 래퍼
// ─────────────────────────────────────────────
function Widget({ title, badge, badgeColor, helpKey, children, className = '' }) {
  return (
    <div className={cn('widget-card flex flex-col', className)}>
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <span className="widget-title">{title}</span>
          {badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{
                color: badgeColor,
                background: badgeColor + '18',
                border: `1px solid ${badgeColor}30`,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="live-dot" />
          {helpKey && <HelpPopover content={HELP[helpKey]} />}
        </div>
      </div>
      <div className="flex-1 p-4">
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 커스텀 차트 툴팁
// ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-[#1e2d40] bg-[#0d1b2a] px-3 py-2 text-xs shadow-xl">
      <p className="text-[#5a7080] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || C.text }}>
          {p.name}: <span className="font-semibold">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// 위젯 1: 공포지수 (VIX)
// ─────────────────────────────────────────────
function VixWidget() {
  const latest = VIX_DATA[VIX_DATA.length - 1].value
  const prev   = VIX_DATA[VIX_DATA.length - 2].value
  const diff   = (latest - prev).toFixed(2)
  const up     = latest > prev
  const status = getVixStatus(latest)

  // VIX 게이지 (0~80 스케일)
  const pct = Math.min((latest / 80) * 100, 100)

  const zoneColor = (val) => {
    if (val < 15) return C.red
    if (val < 20) return C.green
    if (val < 30) return C.yellow
    if (val < 40) return C.orange
    return C.red
  }

  return (
    <Widget title="공포지수 (VIX)" badge={status.label} badgeColor={status.color} helpKey="vix" className="col-span-2">
      <div className="flex gap-6">
        {/* 좌측: 수치 */}
        <div className="w-32 shrink-0 space-y-3">
          <div>
            <p className="stat-label">현재 VIX</p>
            <p className="stat-value" style={{ color: status.color }}>{latest.toFixed(1)}</p>
            <p className="text-xs mt-0.5" style={{ color: up ? C.red : C.green }}>
              {up ? '▲' : '▼'} {Math.abs(diff)} 전일比
            </p>
          </div>
          {/* 게이지 바 */}
          <div>
            <p className="stat-label mb-1">공포 게이지</p>
            <div className="h-2 w-full rounded-full bg-[#1e2d40] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${C.green}, ${C.yellow}, ${C.orange}, ${C.red})`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5" style={{ color: C.muted }}>
              <span>0</span><span>20</span><span>40</span><span>80</span>
            </div>
          </div>
          {/* 구간 범례 */}
          <div className="space-y-1 text-[10px]">
            {[
              { label: '<15 극도탐욕', color: C.red },
              { label: '15~20 안정',  color: C.green },
              { label: '20~30 주의',  color: C.yellow },
              { label: '30~40 공포',  color: C.orange },
              { label: '>40 극도공포',color: C.red },
            ].map(z => (
              <div key={z.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: z.color }} />
                <span style={{ color: C.muted }}>{z.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 차트 */}
        <div className="flex-1 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={VIX_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="vixGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={status.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={status.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={30} stroke={C.orange} strokeDasharray="4 4" label={{ value: '공포선 30', fill: C.orange, fontSize: 9, position: 'insideTopLeft' }} />
              <ReferenceLine y={20} stroke={C.green}  strokeDasharray="4 4" />
              <Area
                type="monotone" dataKey="value" name="VIX"
                stroke={status.color} fill="url(#vixGrad)" strokeWidth={1.5}
                dot={false} activeDot={{ r: 3, fill: status.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯 2: 국민연금 포트폴리오
// ─────────────────────────────────────────────
function NpsWidget() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // GitHub Pages 배포 시 base 경로 포함
      const base = import.meta.env.BASE_URL || '/'
      const res = await fetch(`${base}data/nps.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdate(json.updated_at || '—')
    } catch (e) {
      setError(e.message)
      // 오류 시 더미 데이터 표시
      setData(FALLBACK_NPS)
      setLastUpdate('데이터 로드 실패 (더미 표시 중)')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const FALLBACK_NPS = {
    updated_at: '2025-01-01',
    stocks: [
      { rank: 1, name: '삼성전자',    value: 28.4, change: +0.3, amount: '약 85조원' },
      { rank: 2, name: 'SK하이닉스',  value: 8.1,  change: +0.2, amount: '약 24조원' },
      { rank: 3, name: 'LG에너지솔루션',value:5.2, change: -0.1, amount: '약 15조원' },
      { rank: 4, name: '삼성바이오로직스',value:4.7,change: +0.1, amount: '약 14조원' },
      { rank: 5, name: '현대차',       value: 3.9,  change: +0.0, amount: '약 12조원' },
      { rank: 6, name: '기아',         value: 3.1,  change: -0.1, amount: '약 9조원'  },
      { rank: 7, name: 'POSCO홀딩스',  value: 2.8,  change: +0.2, amount: '약 8조원'  },
      { rank: 8, name: 'KB금융',       value: 2.5,  change: +0.1, amount: '약 7조원'  },
    ]
  }

  const stocks = data?.stocks || []

  return (
    <Widget title="국민연금 포트폴리오" badge="NPS" badgeColor={C.accent} helpKey="nps" className="col-span-2 row-span-2">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px]" style={{ color: C.muted }}>
          업데이트: <span style={{ color: C.text }}>{lastUpdate}</span>
          {error && <span className="ml-2" style={{ color: C.yellow }}>⚠ {error}</span>}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[#1e2d40] hover:border-[#1a73e8] transition-colors"
          style={{ color: C.muted }}
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-xs" style={{ color: C.muted }}>
          <RefreshCw size={14} className="animate-spin mr-2" /> 데이터 로딩 중...
        </div>
      ) : (
        <div className="flex gap-4 h-full">
          {/* 테이블 */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2d40]">
                  <th className="pb-2 text-left font-normal" style={{ color: C.muted }}>순위</th>
                  <th className="pb-2 text-left font-normal" style={{ color: C.muted }}>종목</th>
                  <th className="pb-2 text-right font-normal" style={{ color: C.muted }}>비중(%)</th>
                  <th className="pb-2 text-right font-normal" style={{ color: C.muted }}>전월比</th>
                  <th className="pb-2 text-right font-normal hidden sm:table-cell" style={{ color: C.muted }}>추정금액</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s, i) => (
                  <tr
                    key={s.rank}
                    className="border-b border-[#1e2d40]/50 hover:bg-[#1e2d40]/20 transition-colors"
                  >
                    <td className="py-2 pr-3" style={{ color: C.muted }}>#{s.rank}</td>
                    <td className="py-2 font-medium" style={{ color: C.text }}>{s.name}</td>
                    <td className="py-2 text-right" style={{ color: C.accent }}>{s.value?.toFixed(1)}%</td>
                    <td className="py-2 text-right" style={{ color: s.change > 0 ? C.green : s.change < 0 ? C.red : C.muted }}>
                      {s.change > 0 ? '+' : ''}{s.change?.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right hidden sm:table-cell" style={{ color: C.muted }}>{s.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 바 차트 */}
          <div className="w-36 h-52 shrink-0">
            <p className="text-[9px] mb-1" style={{ color: C.muted }}>비중 시각화</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stocks.slice(0, 6)}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fill: C.muted, fontSize: 8 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: C.text, fontSize: 8 }} tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  content={({ active, payload }) => active && payload?.length
                    ? <div className="bg-[#0d1b2a] border border-[#1e2d40] rounded px-2 py-1 text-xs">
                        <p style={{ color: C.accent }}>{payload[0].value?.toFixed(1)}%</p>
                      </div>
                    : null
                  }
                />
                <Bar dataKey="value" fill={C.accent} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯 3: 신용잔고 비율
// ─────────────────────────────────────────────
function CreditWidget() {
  const latest = CREDIT_DATA[CREDIT_DATA.length - 1].ratio
  const prev   = CREDIT_DATA[CREDIT_DATA.length - 2].ratio
  const up     = latest > prev

  return (
    <Widget title="신용잔고 비율" badge={up ? '▲ 과열 주의' : '▼ 감소'} badgeColor={up ? C.orange : C.green} helpKey="credit">
      <div className="mb-3">
        <p className="stat-label">코스피 신용잔고 비율</p>
        <div className="flex items-end gap-2">
          <p className="stat-value" style={{ color: up ? C.orange : C.green }}>{latest.toFixed(2)}%</p>
          <p className="text-xs mb-1" style={{ color: up ? C.red : C.green }}>
            {up ? '▲' : '▼'} {Math.abs(latest - prev).toFixed(2)}%
          </p>
        </div>
        <p className="text-[10px] mt-1" style={{ color: C.muted }}>* 전고점 2.85% 대비 현재 위치 모니터링</p>
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={CREDIT_DATA} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.orange} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.orange} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} domain={[1.5, 3]} />
            <Tooltip content={<ChartTooltip unit="%" />} />
            <ReferenceLine y={2.85} stroke={C.red} strokeDasharray="4 4" label={{ value: '전고점', fill: C.red, fontSize: 9 }} />
            <Area type="monotone" dataKey="ratio" name="신용잔고" stroke={C.orange} fill="url(#creditGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯 4: 연준(Fed) 방향성
// ─────────────────────────────────────────────
function FedWidget() {
  const latest = FED_DATA[FED_DATA.length - 1]
  const prev   = FED_DATA[FED_DATA.length - 2]
  const rateUp = latest.rate > prev.rate
  const dxyUp  = latest.dxy  > prev.dxy

  const danger = rateUp && dxyUp

  return (
    <Widget
      title="연준(Fed) 방향성 / 매크로"
      badge={danger ? '⚠ 위험자산 주의' : '안정'}
      badgeColor={danger ? C.red : C.green}
      helpKey="fed"
    >
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="stat-label">미 국채 10Y 금리</p>
          <p className="text-xl font-semibold" style={{ color: rateUp ? C.red : C.green }}>
            {latest.rate.toFixed(2)}%
          </p>
          <p className="text-[10px]" style={{ color: rateUp ? C.red : C.green }}>
            {rateUp ? '▲ 상승' : '▼ 하락'} ({Math.abs(latest.rate - prev.rate).toFixed(2)}%)
          </p>
        </div>
        <div>
          <p className="stat-label">달러 인덱스 (DXY)</p>
          <p className="text-xl font-semibold" style={{ color: dxyUp ? C.red : C.green }}>
            {latest.dxy.toFixed(1)}
          </p>
          <p className="text-[10px]" style={{ color: dxyUp ? C.red : C.green }}>
            {dxyUp ? '▲ 강달러' : '▼ 약달러'} ({Math.abs(latest.dxy - prev.dxy).toFixed(1)})
          </p>
        </div>
      </div>
      {danger && (
        <div className="mb-2 flex items-center gap-1.5 rounded border border-[#f44336]/30 bg-[#f44336]/10 px-2 py-1.5 text-[10px]" style={{ color: C.red }}>
          <AlertTriangle size={10} />
          금리·달러 동반 상승 — 주식 비중 축소 고려
        </div>
      )}
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={FED_DATA} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="rate" name="금리(%)" stroke={C.accent} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="dxy"  name="DXY" stroke={C.yellow} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯 5: 시장 건강 상태 (신고가 비율)
// ─────────────────────────────────────────────
function BreadthWidget() {
  const latest = BREADTH_DATA[BREADTH_DATA.length - 1]
  const prev   = BREADTH_DATA[BREADTH_DATA.length - 2]
  const ratio  = (latest.highs / (latest.highs + latest.lows) * 100).toFixed(1)
  const healthy = parseFloat(ratio) > 60

  return (
    <Widget
      title="시장 건강 상태 (신고가 비율)"
      badge={healthy ? '건강' : '약화'}
      badgeColor={healthy ? C.green : C.orange}
      helpKey="breadth"
      className="col-span-2"
    >
      <div className="flex gap-6">
        <div className="w-40 shrink-0 space-y-3">
          <div>
            <p className="stat-label">신고가 비율</p>
            <p className="stat-value" style={{ color: healthy ? C.green : C.orange }}>{ratio}%</p>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span style={{ color: C.green }}>신고가 종목</span>
              <span className="font-semibold" style={{ color: C.green }}>{latest.highs}개</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: C.red }}>신저가 종목</span>
              <span className="font-semibold" style={{ color: C.red }}>{latest.lows}개</span>
            </div>
            <div className="flex justify-between border-t border-[#1e2d40] pt-1.5">
              <span style={{ color: C.muted }}>전일 신고가</span>
              <span style={{ color: C.muted }}>{prev.highs}개</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: C.muted }}>증감</span>
              <span style={{ color: latest.highs > prev.highs ? C.green : C.red }}>
                {latest.highs > prev.highs ? '+' : ''}{latest.highs - prev.highs}개
              </span>
            </div>
          </div>
          {/* 비율 원형 게이지 */}
          <div className="flex flex-col items-center">
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="28" fill="none" stroke={C.border} strokeWidth="6" />
              <circle
                cx="35" cy="35" r="28"
                fill="none"
                stroke={healthy ? C.green : C.orange}
                strokeWidth="6"
                strokeDasharray={`${parseFloat(ratio) * 1.759} 175.9`}
                strokeLinecap="round"
                transform="rotate(-90 35 35)"
              />
              <text x="35" y="39" textAnchor="middle" fontSize="12" fill={healthy ? C.green : C.orange} fontFamily="monospace">
                {ratio}%
              </text>
            </svg>
          </div>
        </div>
        <div className="flex-1 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={BREADTH_DATA} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="개" />} />
              <Bar dataKey="highs" name="신고가" fill={C.green} radius={[2, 2, 0, 0]} />
              <Bar dataKey="lows"  name="신저가" fill={C.red}   radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 좌측 사이드바
// ─────────────────────────────────────────────
function Sidebar() {
  // 체크리스트 — LocalStorage 유지
  const [checklist, setChecklist] = useState(() => {
    try {
      const saved = localStorage.getItem('hemstock_checklist')
      return saved ? JSON.parse(saved) : DEFAULT_CHECKLIST
    } catch { return DEFAULT_CHECKLIST }
  })

  // 매매 일지 — LocalStorage 유지
  const [journal, setJournal] = useState(() => {
    try { return localStorage.getItem('hemstock_journal') || '' }
    catch { return '' }
  })

  // 오늘 매매 여부
  const [traded, setTraded] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('hemstock_traded') || 'null')
      if (!saved) return null
      if (saved.date === new Date().toDateString()) return saved.value
      return null
    } catch { return null }
  })

  const [newItem, setNewItem] = useState('')

  const saveChecklist = (list) => {
    setChecklist(list)
    localStorage.setItem('hemstock_checklist', JSON.stringify(list))
  }

  const toggleCheck = (id) => {
    saveChecklist(checklist.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  }

  const addItem = () => {
    if (!newItem.trim()) return
    const item = { id: `c${Date.now()}`, text: newItem.trim(), checked: false }
    saveChecklist([...checklist, item])
    setNewItem('')
  }

  const removeItem = (id) => {
    saveChecklist(checklist.filter(c => c.id !== id))
  }

  const resetAll = () => {
    saveChecklist(checklist.map(c => ({ ...c, checked: false })))
  }

  const saveJournal = (v) => {
    setJournal(v)
    localStorage.setItem('hemstock_journal', v)
  }

  const setTradedValue = (val) => {
    setTraded(val)
    localStorage.setItem('hemstock_traded', JSON.stringify({ date: new Date().toDateString(), value: val }))
  }

  const checked = checklist.filter(c => c.checked).length
  const total   = checklist.length
  const pct     = total ? Math.round((checked / total) * 100) : 0

  return (
    <aside className="w-72 shrink-0 flex flex-col h-screen overflow-hidden border-r border-[#1e2d40] bg-[#0d1b2a]">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-[#1e2d40]">
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: C.accent }} />
          <h1 className="text-sm font-semibold tracking-wider" style={{ color: C.text }}>HemStock</h1>
        </div>
        <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>매매기준 모니터링 대시보드</p>
        <p className="text-[10px]" style={{ color: C.muted }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* 오늘 매매 여부 */}
        <div className="sidebar-section">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>
            오늘 매매 여부
          </p>
          <div className="flex gap-2">
            {[
              { label: '매매함', value: 'yes', color: C.green },
              { label: '안함',   value: 'no',  color: C.muted },
              { label: '관망',   value: 'watch', color: C.yellow },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setTradedValue(opt.value)}
                className="flex-1 py-1.5 rounded text-[10px] font-semibold border transition-all"
                style={{
                  borderColor: traded === opt.value ? opt.color : C.border,
                  color:       traded === opt.value ? opt.color : C.muted,
                  background:  traded === opt.value ? opt.color + '15' : 'transparent',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 체크리스트 */}
        <div className="sidebar-section">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>
              매매 기준 체크리스트
            </p>
            <button onClick={resetAll} className="text-[9px] hover:text-[#1a73e8] transition-colors" style={{ color: C.muted }}>
              초기화
            </button>
          </div>
          {/* 진행률 바 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 rounded-full bg-[#1e2d40] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? C.green : C.accent }}
              />
            </div>
            <span className="text-[10px] shrink-0" style={{ color: pct === 100 ? C.green : C.muted }}>
              {checked}/{total}
            </span>
          </div>
          {/* 항목 목록 */}
          <div className="space-y-0.5">
            {checklist.map(item => (
              <div key={item.id} className="checklist-item group">
                <button
                  onClick={() => toggleCheck(item.id)}
                  className="shrink-0 transition-colors"
                  style={{ color: item.checked ? C.green : C.muted }}
                >
                  {item.checked
                    ? <CheckSquare size={13} />
                    : <Square size={13} />
                  }
                </button>
                <span
                  className="flex-1 text-[11px] leading-tight"
                  style={{ color: item.checked ? C.muted : C.text, textDecoration: item.checked ? 'line-through' : 'none' }}
                >
                  {item.text}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ color: C.muted }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
          {/* 항목 추가 */}
          <div className="flex gap-1 mt-2">
            <input
              type="text"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="체크항목 추가..."
              className="flex-1 bg-[#1e2d40]/50 border border-[#1e2d40] rounded px-2 py-1 text-[10px] outline-none focus:border-[#1a73e8] placeholder:text-[#5a7080]"
              style={{ color: C.text }}
            />
            <button
              onClick={addItem}
              className="px-2 py-1 rounded text-[10px] transition-colors hover:bg-[#1a73e8]/20"
              style={{ color: C.accent, border: `1px solid ${C.accent}30` }}
            >
              +
            </button>
          </div>
        </div>

        {/* 매매 일지 */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>
            오늘 매매 메모
          </p>
          <textarea
            value={journal}
            onChange={e => saveJournal(e.target.value)}
            placeholder="오늘의 판단 근거, 반성, 배운 점을 기록하세요..."
            rows={8}
            className="w-full bg-[#0a0e14] border border-[#1e2d40] rounded px-3 py-2 text-[11px] leading-relaxed outline-none focus:border-[#1a73e8] resize-none placeholder:text-[#5a7080]"
            style={{ color: C.text }}
          />
          <p className="text-[9px] mt-1" style={{ color: C.muted }}>자동 저장 (LocalStorage)</p>
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────
// 상단 헤더 바
// ─────────────────────────────────────────────
function TopBar() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const indices = [
    { name: 'KOSPI',  value: '2,748.32', change: '+0.82%',  up: true  },
    { name: 'KOSDAQ', value: '  856.71', change: '-0.14%',  up: false },
    { name: 'S&P500', value: '5,521.14', change: '+0.31%',  up: true  },
    { name: 'NASDAQ', value: '17,834.23',change: '+0.56%',  up: true  },
    { name: 'USD/KRW',value: '1,382.40', change: '-0.22%',  up: false },
  ]

  return (
    <header
      className="flex items-center justify-between px-4 py-2 border-b text-xs"
      style={{ background: C.header, borderColor: C.border }}
    >
      <div className="flex items-center gap-4">
        {indices.map(idx => (
          <div key={idx.name} className="flex items-center gap-1.5">
            <span style={{ color: C.muted }}>{idx.name}</span>
            <span style={{ color: C.text }}>{idx.value}</span>
            <span style={{ color: idx.up ? C.green : C.red }}>{idx.change}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="live-dot" />
          <span style={{ color: C.muted }}>LIVE</span>
        </div>
        <span style={{ color: C.text }}>{time.toLocaleTimeString('ko-KR')}</span>
        <span style={{ color: C.muted }}>KST</span>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────
// 메인 대시보드
// ─────────────────────────────────────────────
export default function Dashboard() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* 사이드바 */}
      <Sidebar />

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 지수 바 */}
        <TopBar />

        {/* 위젯 그리드 */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-4 auto-rows-min">
            {/* Row 1: VIX(2칸) + 신용잔고(2칸) */}
            <VixWidget />
            <CreditWidget />

            {/* Row 2: 국민연금(2칸, row-span-2) + 연준(1칸) + 빈칸 -> 실은 col-span 조정 */}
            <div className="col-span-2 row-span-2">
              <NpsWidget className="h-full" />
            </div>
            <FedWidget />

            {/* Row 3: 시장 건강(2칸) */}
            <BreadthWidget />

            {/* 푸터 */}
            <div className="col-span-4 flex items-center justify-between px-1 py-2 text-[10px]" style={{ color: C.muted }}>
              <span>HemStock v0.1 · GitHub Pages · 데이터는 투자 참고용이며 투자 권유가 아닙니다.</span>
              <span>매일 04:00 KST 자동 갱신</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
