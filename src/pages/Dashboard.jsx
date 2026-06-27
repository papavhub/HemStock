import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Info, CheckSquare, Square, RefreshCw, Activity,
  X, AlertTriangle, TrendingUp, TrendingDown, Bitcoin, DollarSign, Gauge,
} from 'lucide-react'

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
  purple: '#9c27b0',
  text:   '#cdd6e0',
  muted:  '#5a7080',
  header: '#0d1b2a',
}

// ─────────────────────────────────────────────
// 도움말 멘트 (위젯별 해석 가이드)
// ─────────────────────────────────────────────
const HELP = {
  vix: '대중과 반대로 행동하세요. VIX가 30 이상으로 치솟으며 \'극도의 공포\' 구간에 진입할 때는 좋은 주식을 분할 매수할 기회이며, 20 미만의 \'안정\' 구간에서는 현금 비중을 점진적으로 확보하는 기준이 됩니다.',
  nps: '시장의 가장 큰 고래인 국민연금의 포트폴리오입니다. 매일 새벽 GitHub Actions가 갱신하며, 기관이 장기적으로 모아가는 우량주 수급의 뼈대를 확인하는 용도입니다. 내 포트폴리오가 이들의 방향성과 너무 어긋나지 않는지 점검하세요.',
  credit: '개인들의 \'빚투\' 열기를 보여줍니다. 비율이 전고점을 뚫고 폭발할 때는 단기 꼭지(과열)일 확률이 매우 높으므로 조심해야 합니다. 반대로 반대매매가 터져 신용잔고 비율이 급감하면 시장의 단기 바닥 신호일 수 있습니다.',
  fed: '증시의 기초체력인 금리와 환율입니다. 미 국채 금리와 달러 인덱스가 동시에 치솟을 때는 위험자산(주식)에서 돈이 빠져나가는 신호이므로 주식 비중을 보수적으로 조절하고, 이 지표들이 하향 안정화될 때 적극적으로 매매를 고려하세요.',
  breadth: '시장의 속살을 보는 지표입니다. 지수는 오르는데 정작 신고가 종목 수가 줄어들고 있다면 소수 대형주만 오르는 \'착시 현상\'이며 하락장의 전조일 수 있습니다. 반대로 지수가 지지부진해도 신고가 종목이 늘어난다면 장의 체력이 좋아지고 있다는 뜻입니다.',
  fng: '암호화폐 시장의 투자심리를 0~100 숫자로 표현한 지표입니다 (출처: alternative.me). 주식시장과 높은 상관관계를 보이며, 25 이하 극도의 공포 구간은 위험자산 전반에 대한 매수 기회일 수 있고, 75 이상 극도의 탐욕 구간은 차익실현을 고민할 시점입니다. 대중의 심리와 반대로 움직이는 역발상 투자의 기준으로 활용하세요.',
  usdkrw: '원달러 환율은 외국인 투자자의 한국 주식 매수·매도 의향을 간접적으로 보여줍니다. 환율이 급등(달러 강세)하면 외국인이 한국 주식을 팔고 달러로 환전해 빠져나가는 신호일 수 있으며, 반대로 환율이 하락(원화 강세)하면 외국인 자금이 국내로 유입되는 환경이 조성됩니다. 출처: ExchangeRate-API (실시간 무료 공개 API)',
  btc: '비트코인 가격은 전 세계 위험자산 선호도를 실시간으로 반영하는 \'카나리아\'입니다. 비트코인이 급락하면 투자자들이 위험을 기피하기 시작했다는 조기 신호이며, 주식시장도 뒤따라 조정받는 경우가 많습니다. 반대로 비트코인이 강하게 오를 때는 위험자산 전반에 대한 선호가 높아진 상태입니다. 출처: CoinGecko 공개 API (무료, 키 불필요)',
}

// ─────────────────────────────────────────────
// Mock 데이터 (API 연동 전 기본값)
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

// 기본 체크리스트
const DEFAULT_CHECKLIST = [
  { id: 'c1', text: '공포탐욕지수 확인 (25 이하 = 분할매수 기회)', checked: false },
  { id: 'c2', text: 'VIX 수준 확인 (30 이상 = 공포 구간)', checked: false },
  { id: 'c3', text: '국민연금 포트 방향성과 내 보유 종목 비교', checked: false },
  { id: 'c4', text: '신용잔고 전고점 대비 위치 확인', checked: false },
  { id: 'c5', text: '미 국채 금리 & 달러인덱스 방향 확인', checked: false },
  { id: 'c6', text: '원달러 환율 급등 여부 확인 (외인 이탈 신호)', checked: false },
  { id: 'c7', text: '비트코인 방향성 확인 (위험자산 선호도)', checked: false },
  { id: 'c8', text: '신고가 종목 수 추세 확인 (이격 여부)', checked: false },
  { id: 'c9', text: '손절 원칙(-8%) 지켰는가?', checked: false },
]

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
function getVixStatus(val) {
  if (val < 15) return { label: '극도의 탐욕', color: C.red }
  if (val < 20) return { label: '안정',         color: C.green }
  if (val < 30) return { label: '주의',         color: C.yellow }
  if (val < 40) return { label: '공포',         color: C.orange }
  return              { label: '극도의 공포',   color: C.red }
}

function getFngStatus(val) {
  if (val <= 25)  return { label: '극도의 공포', color: C.red,    action: '매수 기회 탐색' }
  if (val <= 45)  return { label: '공포',        color: C.orange, action: '분할 매수 검토' }
  if (val <= 55)  return { label: '중립',        color: C.muted,  action: '관망' }
  if (val <= 75)  return { label: '탐욕',        color: C.yellow, action: '차익실현 검토' }
  return               { label: '극도의 탐욕', color: C.green,  action: '현금 비중 확대' }
}

function cn(...classes) { return classes.filter(Boolean).join(' ') }

// 숫자 포맷
function fmtNum(n, digits = 0) {
  return n?.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) ?? '—'
}

// ─────────────────────────────────────────────
// 실시간 데이터 훅
// ─────────────────────────────────────────────

/** alternative.me — 공포탐욕지수 (키 불필요) */
function useFearAndGreed() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // limit=8 : 오늘 포함 최근 8일치 (차트용)
      const res  = await fetch('https://api.alternative.me/fng/?limit=8&format=json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      // 최신→과거 순으로 오므로 역순
      const items = [...(json.data || [])].reverse()
      setData(items)
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** ExchangeRate-API — USD/KRW (키 불필요) */
function useUsdKrw() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('https://open.er-api.com/v6/latest/USD')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData({
        krw:        json.rates?.KRW,
        jpy:        json.rates?.JPY,
        cny:        json.rates?.CNY,
        eur:        json.rates?.EUR,
        updatedAt:  json.time_last_update_utc,
      })
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** CoinGecko — 비트코인 가격 (키 불필요) */
function useBitcoin() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,krw&include_24hr_change=true&include_market_cap=true'
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const btc  = json.bitcoin
      setData({
        usd:       btc.usd,
        krw:       btc.krw,
        change24h: btc.usd_24h_change,
        capUsd:    btc.usd_market_cap,
      })
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

// ─────────────────────────────────────────────
// 도움말 팝오버
// ─────────────────────────────────────────────
function HelpPopover({ content }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="text-[#5a7080] hover:text-[#1a73e8] transition-colors p-0.5">
        <Info size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 w-72 rounded-lg border border-[#1a73e8] bg-[#0f1520] p-3 text-xs leading-relaxed shadow-2xl" style={{ color: C.text }}>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-[#1a73e8]">💡</span>
            <p>{content}</p>
          </div>
          <button onClick={() => setOpen(false)} className="absolute right-2 top-2 text-[#5a7080] hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 데이터 출처 배지
// ─────────────────────────────────────────────
function SourceBadge({ label, url }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-[9px] px-1.5 py-0.5 rounded border transition-colors hover:border-[#1a73e8]"
      style={{ color: C.muted, borderColor: C.border }}>
      📡 {label}
    </a>
  )
}

// ─────────────────────────────────────────────
// 위젯 공통 래퍼
// ─────────────────────────────────────────────
function Widget({ title, badge, badgeColor, helpKey, source, sourceUrl, children, className = '', isLive = false }) {
  return (
    <div className={cn('flex flex-col rounded-lg overflow-hidden border', className)}
      style={{ background: C.panel, borderColor: C.border }}>
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ background: C.header, borderColor: C.border }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: C.muted }}>{title}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ color: badgeColor, background: badgeColor + '18', border: `1px solid ${badgeColor}30` }}>
              {badge}
            </span>
          )}
          {source && <SourceBadge label={source} url={sourceUrl} />}
        </div>
        <div className="flex items-center gap-2">
          {isLive && <div className="live-dot" />}
          {helpKey && <HelpPopover content={HELP[helpKey]} />}
        </div>
      </div>
      <div className="flex-1 p-4">{children}</div>
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
      <p className="mb-1" style={{ color: C.muted }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || C.text }}>
          {p.name}: <span className="font-semibold">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  )
}

// 로딩 스피너
function Spinner({ text = '로딩 중...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs" style={{ color: C.muted }}>
      <RefreshCw size={13} className="animate-spin" />{text}
    </div>
  )
}

// 에러 표시
function ApiError({ msg, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-xs" style={{ color: C.red }}>
      <AlertTriangle size={14} />
      <p>API 오류: {msg}</p>
      <button onClick={onRetry} className="px-3 py-1 rounded border text-[10px] hover:bg-[#f44336]/10 transition-colors"
        style={{ borderColor: C.red, color: C.red }}>
        재시도
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// ① 공포탐욕지수 위젯 (실시간 — alternative.me)
// ─────────────────────────────────────────────
function FearAndGreedWidget() {
  const { data, loading, error, refetch } = useFearAndGreed()

  const latest   = data?.[data.length - 1]
  const val      = latest ? parseInt(latest.value) : null
  const status   = val !== null ? getFngStatus(val) : null
  const chartData = (data || []).map(d => ({
    date:  new Date(parseInt(d.timestamp) * 1000).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
    value: parseInt(d.value),
    label: d.value_classification,
  }))

  // 게이지용 색상 그라디언트
  const gaugeColor = status?.color ?? C.muted
  const pct = val !== null ? val : 0

  return (
    <Widget title="공포탐욕지수 (실시간)" badge={status?.label} badgeColor={status?.color}
      helpKey="fng" source="alternative.me/fng" sourceUrl="https://alternative.me/crypto/fear-and-greed-index/"
      isLive className="col-span-2">

      {/* 설명 텍스트 */}
      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        암호화폐·주식 시장 참여자들의 심리 온도계. 0에 가까울수록 공포(매수 기회), 100에 가까울수록 탐욕(매도 신호).
      </p>

      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="flex gap-5">
          {/* 좌측: 수치 + 게이지 */}
          <div className="w-36 shrink-0 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>현재 지수</p>
              <p className="text-4xl font-bold" style={{ color: gaugeColor }}>{val}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: gaugeColor }}>{status?.label}</p>
              <p className="text-[10px] mt-1 px-1.5 py-0.5 rounded inline-block"
                style={{ background: gaugeColor + '18', color: gaugeColor, border: `1px solid ${gaugeColor}30` }}>
                → {status?.action}
              </p>
            </div>
            {/* 아크 게이지 */}
            <svg width="120" height="70" viewBox="0 0 120 70">
              <defs>
                <linearGradient id="fngGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor={C.red} />
                  <stop offset="25%"  stopColor={C.orange} />
                  <stop offset="50%"  stopColor={C.yellow} />
                  <stop offset="75%"  stopColor="#8bc34a" />
                  <stop offset="100%" stopColor={C.green} />
                </linearGradient>
              </defs>
              {/* 배경 반원 */}
              <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={C.border} strokeWidth="8" strokeLinecap="round" />
              {/* 값 반원 */}
              <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="url(#fngGrad)"
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 157} 157`} />
              {/* 중앙 텍스트 */}
              <text x="60" y="60" textAnchor="middle" fontSize="11" fontFamily="monospace" fontWeight="bold" fill={gaugeColor}>{val}</text>
            </svg>
            {/* 범례 */}
            <div className="space-y-1 text-[9px]">
              {[
                { r: '0–25',   l: '극도의 공포', c: C.red },
                { r: '26–45',  l: '공포',        c: C.orange },
                { r: '46–55',  l: '중립',        c: C.muted },
                { r: '56–75',  l: '탐욕',        c: C.yellow },
                { r: '76–100', l: '극도의 탐욕', c: C.green },
              ].map(z => (
                <div key={z.r} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm shrink-0 inline-block" style={{ background: z.c }} />
                  <span style={{ color: z.r.split('–')[0] <= val && val <= z.r.split('–')[1] ? z.c : C.muted }}>
                    {z.r} {z.l}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 우측: 7일 차트 */}
          <div className="flex-1">
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>최근 8일 추이</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fngAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={gaugeColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={gaugeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={({ active, payload, label }) =>
                    active && payload?.length
                      ? <div className="bg-[#0d1b2a] border border-[#1e2d40] rounded px-2 py-1 text-xs">
                          <p style={{ color: C.muted }}>{label}</p>
                          <p style={{ color: gaugeColor }}>지수: <b>{payload[0].value}</b></p>
                          <p style={{ color: C.muted }}>{payload[0].payload.label}</p>
                        </div>
                      : null
                  } />
                  <ReferenceLine y={25} stroke={C.red}    strokeDasharray="3 3" label={{ value: '공포선', fill: C.red,    fontSize: 9 }} />
                  <ReferenceLine y={75} stroke={C.green}  strokeDasharray="3 3" label={{ value: '탐욕선', fill: C.green,  fontSize: 9 }} />
                  <Area type="monotone" dataKey="value" name="지수" stroke={gaugeColor}
                    fill="url(#fngAreaGrad)" strokeWidth={1.5} dot={{ r: 3, fill: gaugeColor }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Widget>
  )
}

// ─────────────────────────────────────────────
// ② USD/KRW 환율 위젯 (실시간 — ExchangeRate-API)
// ─────────────────────────────────────────────
function UsdKrwWidget() {
  const { data, loading, error, refetch } = useUsdKrw()

  // 위험 신호: 1400원 이상 = 외인 이탈 경계
  const isDanger  = data?.krw >= 1400
  const isWarning = data?.krw >= 1350 && data?.krw < 1400

  const statusColor = isDanger ? C.red : isWarning ? C.orange : C.green
  const statusLabel = isDanger ? '위험 (외인 이탈)' : isWarning ? '주의' : '안정'

  const currencies = data ? [
    { label: 'USD/KRW', value: fmtNum(data.krw, 1), sub: '원',  alert: isDanger || isWarning },
    { label: 'USD/JPY', value: fmtNum(data.jpy, 2), sub: '엔',  alert: false },
    { label: 'USD/CNY', value: fmtNum(data.cny, 4), sub: '위안', alert: false },
    { label: 'USD/EUR', value: fmtNum(data.eur, 4), sub: '유로', alert: false },
  ] : []

  return (
    <Widget title="원달러 환율 (실시간)" badge={statusLabel} badgeColor={statusColor}
      helpKey="usdkrw" source="ExchangeRate-API" sourceUrl="https://open.er-api.com"
      isLive>

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        달러 대비 원화 가치. 숫자가 높을수록 원화 약세(달러 강세)이며 외국인 자금이 이탈하는 환경입니다.
        <span style={{ color: C.red }}> 1,400원 이상</span>은 경계 구간입니다.
      </p>

      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="space-y-3">
          {/* 메인 환율 크게 */}
          <div className="flex items-end gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>USD / KRW</p>
              <p className="text-3xl font-bold" style={{ color: statusColor }}>
                ₩ {fmtNum(data.krw, 1)}
              </p>
            </div>
            <div className="mb-1 space-y-0.5">
              {isDanger && (
                <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                  style={{ background: C.red + '18', color: C.red, border: `1px solid ${C.red}30` }}>
                  <AlertTriangle size={9} /> 1,400원 돌파 — 외인 이탈 주의
                </div>
              )}
              <p className="text-[10px]" style={{ color: C.muted }}>
                기준: {data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR') : '—'}
              </p>
            </div>
          </div>

          {/* 구간별 해석 */}
          <div className="grid grid-cols-3 gap-1 text-[9px]">
            {[
              { range: '~1,200', label: '원화 강세', sub: '외인 유입', color: C.green },
              { range: '1,200~1,350', label: '보통', sub: '중립', color: C.muted },
              { range: '1,350~1,400', label: '원화 약세', sub: '주의', color: C.yellow },
              { range: '1,400~', label: '위험', sub: '외인 이탈', color: C.red },
            ].map(z => (
              <div key={z.range} className="rounded px-1.5 py-1" style={{ background: z.color + '10', border: `1px solid ${z.color}20` }}>
                <p style={{ color: z.color }} className="font-semibold">{z.range}</p>
                <p style={{ color: z.color }}>{z.label}</p>
                <p style={{ color: C.muted }}>{z.sub}</p>
              </div>
            ))}
          </div>

          {/* 다른 통화 */}
          <div className="border-t pt-2" style={{ borderColor: C.border }}>
            <p className="text-[9px] mb-1.5" style={{ color: C.muted }}>주요 통화 (기준: 1 USD)</p>
            <div className="grid grid-cols-2 gap-1">
              {currencies.slice(1).map(c => (
                <div key={c.label} className="flex justify-between items-center">
                  <span className="text-[10px]" style={{ color: C.muted }}>{c.label}</span>
                  <span className="text-[10px] font-semibold" style={{ color: C.text }}>{c.value} {c.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Widget>
  )
}

// ─────────────────────────────────────────────
// ③ 비트코인 위젯 (실시간 — CoinGecko)
// ─────────────────────────────────────────────
function BitcoinWidget() {
  const { data, loading, error, refetch } = useBitcoin()

  const change = data?.change24h ?? 0
  const isUp   = change >= 0
  const changeColor = isUp ? C.green : C.red

  const riskSignal = change <= -5
    ? { label: '⚠ 위험자산 기피 신호', color: C.red }
    : change >= 5
      ? { label: '위험자산 선호 강화', color: C.green }
      : null

  return (
    <Widget title="비트코인 (위험자산 선호도)" badge={riskSignal?.label} badgeColor={riskSignal?.color}
      helpKey="btc" source="CoinGecko API" sourceUrl="https://www.coingecko.com/en/api"
      isLive>

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        비트코인은 위험자산의 선행 지표. <span style={{ color: C.red }}>24시간 -5% 이상 급락</span>은 주식시장 조정의 전조 신호로 해석합니다.
      </p>

      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="space-y-3">
          {/* 가격 */}
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>BTC / USD</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold" style={{ color: C.text }}>
                ${fmtNum(data.usd)}
              </p>
              <div className="mb-0.5 flex items-center gap-1">
                {isUp ? <TrendingUp size={13} color={C.green} /> : <TrendingDown size={13} color={C.red} />}
                <span className="text-sm font-semibold" style={{ color: changeColor }}>
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </span>
                <span className="text-[10px]" style={{ color: C.muted }}>24h</span>
              </div>
            </div>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              ≈ ₩{fmtNum(data.krw)}
            </p>
          </div>

          {/* 시가총액 */}
          <div className="rounded px-3 py-2" style={{ background: C.border + '40' }}>
            <p className="text-[10px]" style={{ color: C.muted }}>시가총액</p>
            <p className="text-sm font-semibold" style={{ color: C.text }}>
              ${(data.capUsd / 1e12).toFixed(2)}조 USD
            </p>
          </div>

          {/* 신호 해석 */}
          <div className="space-y-1 text-[10px]">
            <p style={{ color: C.muted }}>📊 시그널 해석 기준</p>
            {[
              { cond: '+5% 이상', label: '위험자산 매수세 강함',   color: C.green,  arrow: '↑' },
              { cond: '±5% 이내', label: '중립 / 방향성 탐색 중', color: C.muted,  arrow: '→' },
              { cond: '-5% 이하', label: '위험자산 기피 시작',     color: C.orange, arrow: '↓' },
              { cond: '-10% 이하',label: '강한 위험 회피 — 주식 비중 축소 검토', color: C.red, arrow: '↓↓' },
            ].map(s => (
              <div key={s.cond} className="flex items-center gap-2">
                <span style={{ color: s.color }} className="font-mono w-4 text-center">{s.arrow}</span>
                <span style={{ color: C.muted }}>{s.cond}</span>
                <span className="ml-auto" style={{ color: s.color }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* 현재 변화량 시각화 */}
          <div>
            <p className="text-[9px] mb-1" style={{ color: C.muted }}>24시간 변동 위치</p>
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
              {/* -10% ~ +10% 범위 */}
              <div className="absolute h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(Math.abs(change) / 10 * 50, 50)}%`,
                  left: isUp ? '50%' : `${50 - Math.min(Math.abs(change) / 10 * 50, 50)}%`,
                  background: changeColor,
                }} />
              <div className="absolute top-0 bottom-0 w-0.5 left-1/2" style={{ background: C.muted }} />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5" style={{ color: C.muted }}>
              <span>-10%</span><span>0</span><span>+10%</span>
            </div>
          </div>
        </div>
      )}
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯: 공포지수 (VIX) — Mock
// ─────────────────────────────────────────────
function VixWidget() {
  const latest = VIX_DATA[VIX_DATA.length - 1].value
  const prev   = VIX_DATA[VIX_DATA.length - 2].value
  const diff   = (latest - prev).toFixed(2)
  const up     = latest > prev
  const status = getVixStatus(latest)

  const pct = Math.min((latest / 80) * 100, 100)

  return (
    <Widget title="공포지수 (VIX)" badge={`${status.label} · Mock`} badgeColor={status.color}
      helpKey="vix" className="col-span-2">

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        S&P500 옵션 가격에서 산출하는 시장 변동성 지수. 높을수록 투자자가 공포를 느끼는 상태.
        현재는 <span style={{ color: C.accent }}>참고용 Mock 데이터</span>입니다.
      </p>

      <div className="flex gap-6">
        <div className="w-32 shrink-0 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>현재 VIX</p>
            <p className="text-2xl font-semibold" style={{ color: status.color }}>{latest.toFixed(1)}</p>
            <p className="text-xs mt-0.5" style={{ color: up ? C.red : C.green }}>
              {up ? '▲' : '▼'} {Math.abs(diff)} 전일比
            </p>
          </div>
          <div>
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>공포 게이지</p>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: C.border }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${C.green}, ${C.yellow}, ${C.orange}, ${C.red})` }} />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5" style={{ color: C.muted }}>
              <span>0</span><span>20</span><span>40</span><span>80</span>
            </div>
          </div>
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
              <ReferenceLine y={30} stroke={C.orange} strokeDasharray="4 4"
                label={{ value: '공포선 30', fill: C.orange, fontSize: 9, position: 'insideTopLeft' }} />
              <ReferenceLine y={20} stroke={C.green} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="value" name="VIX" stroke={status.color}
                fill="url(#vixGrad)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: status.color }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯: 국민연금 포트폴리오
// ─────────────────────────────────────────────
function NpsWidget() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const base = import.meta.env.BASE_URL || '/'
      const res  = await fetch(`${base}data/nps.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const stocks = data?.stocks || []

  return (
    <Widget title="국민연금 포트폴리오" badge="NPS · GitHub Actions 갱신" badgeColor={C.accent}
      helpKey="nps" source="GitHub Actions 자동수집" sourceUrl="https://github.com/papavhub/HemStock/actions"
      className="col-span-2 row-span-2">

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        국민연금은 국내 주식 시장의 최대 기관 투자자로 약 <span style={{ color: C.text }}>100조원</span> 이상을 운용합니다.
        매일 새벽 4시 GitHub Actions가 자동으로 데이터를 갱신합니다.
      </p>

      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px]" style={{ color: C.muted }}>
          업데이트: <span style={{ color: C.text }}>{data?.updated_at ?? '—'}</span>
          <span className="ml-2" style={{ color: C.muted }}>출처: {data?.source ?? '—'}</span>
          {error && <span className="ml-2" style={{ color: C.yellow }}>⚠ {error}</span>}
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border hover:border-[#1a73e8] transition-colors"
          style={{ color: C.muted, borderColor: C.border }}>
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="flex gap-4 h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: C.border }}>
                  {['순위','종목','비중(%)','전월比','추정금액'].map(h => (
                    <th key={h} className={`pb-2 font-normal ${h==='추정금액'?'text-right hidden sm:table-cell':h==='순위'?'text-left':'text-right'}`}
                      style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.map(s => (
                  <tr key={s.rank} className="border-b hover:bg-[#1e2d40]/20 transition-colors"
                    style={{ borderColor: C.border + '80' }}>
                    <td className="py-2 pr-3" style={{ color: C.muted }}>#{s.rank}</td>
                    <td className="py-2 font-medium" style={{ color: C.text }}>{s.name}</td>
                    <td className="py-2 text-right" style={{ color: C.accent }}>{s.value?.toFixed(1)}%</td>
                    <td className="py-2 text-right"
                      style={{ color: s.change > 0 ? C.green : s.change < 0 ? C.red : C.muted }}>
                      {s.change > 0 ? '+' : ''}{s.change?.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right hidden sm:table-cell" style={{ color: C.muted }}>{s.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="w-36 h-52 shrink-0">
            <p className="text-[9px] mb-1" style={{ color: C.muted }}>비중 시각화</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stocks.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: C.muted, fontSize: 8 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: C.text, fontSize: 8 }} tickLine={false} axisLine={false} width={60} />
                <Tooltip content={({ active, payload }) =>
                  active && payload?.length
                    ? <div className="bg-[#0d1b2a] border border-[#1e2d40] rounded px-2 py-1 text-xs">
                        <p style={{ color: C.accent }}>{payload[0].value?.toFixed(1)}%</p>
                      </div>
                    : null
                } />
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
// 위젯: 신용잔고 비율 — Mock
// ─────────────────────────────────────────────
function CreditWidget() {
  const latest = CREDIT_DATA[CREDIT_DATA.length - 1].ratio
  const prev   = CREDIT_DATA[CREDIT_DATA.length - 2].ratio
  const up     = latest > prev

  return (
    <Widget title="신용잔고 비율" badge={`${up ? '▲ 과열 주의' : '▼ 감소'} · Mock`} badgeColor={up ? C.orange : C.green}
      helpKey="credit" className="col-span-2">

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        증권사에서 돈을 빌려 주식을 산 금액(신용잔고)의 시장 비율. 높을수록 개인 투자자의 레버리지 과열 상태.
        현재 <span style={{ color: C.accent }}>참고용 Mock 데이터</span>입니다.
      </p>

      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>코스피 신용잔고 비율</p>
        <div className="flex items-end gap-2">
          <p className="text-2xl font-semibold" style={{ color: up ? C.orange : C.green }}>{latest.toFixed(2)}%</p>
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
            <ReferenceLine y={2.85} stroke={C.red} strokeDasharray="4 4"
              label={{ value: '전고점', fill: C.red, fontSize: 9 }} />
            <Area type="monotone" dataKey="ratio" name="신용잔고" stroke={C.orange}
              fill="url(#creditGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯: 연준(Fed) 방향성 — Mock
// ─────────────────────────────────────────────
function FedWidget() {
  const latest = FED_DATA[FED_DATA.length - 1]
  const prev   = FED_DATA[FED_DATA.length - 2]
  const rateUp = latest.rate > prev.rate
  const dxyUp  = latest.dxy  > prev.dxy
  const danger = rateUp && dxyUp

  return (
    <Widget title="연준(Fed) 방향성 / 매크로" badge={`${danger ? '⚠ 위험자산 주의' : '안정'} · Mock`}
      badgeColor={danger ? C.red : C.green} helpKey="fed" className="col-span-2">

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        미 국채 10년물 금리(채권 시장의 기준금리)와 달러 인덱스(DXY, 달러 가치).
        두 지표가 <span style={{ color: C.red }}>동시에 상승</span>하면 주식에서 채권·달러로 돈이 이동합니다.
        현재 <span style={{ color: C.accent }}>참고용 Mock 데이터</span>입니다.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>미 국채 10Y 금리</p>
          <p className="text-xl font-semibold" style={{ color: rateUp ? C.red : C.green }}>{latest.rate.toFixed(2)}%</p>
          <p className="text-[10px]" style={{ color: rateUp ? C.red : C.green }}>
            {rateUp ? '▲ 상승 (채권 매도 = 주식 부담)' : '▼ 하락 (주식 우호적)'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>달러 인덱스 (DXY)</p>
          <p className="text-xl font-semibold" style={{ color: dxyUp ? C.red : C.green }}>{latest.dxy.toFixed(1)}</p>
          <p className="text-[10px]" style={{ color: dxyUp ? C.red : C.green }}>
            {dxyUp ? '▲ 강달러 (신흥국 자금 이탈)' : '▼ 약달러 (위험자산 선호)'}
          </p>
        </div>
      </div>
      {danger && (
        <div className="mb-2 flex items-center gap-1.5 rounded border px-2 py-1.5 text-[10px]"
          style={{ color: C.red, borderColor: C.red + '30', background: C.red + '10' }}>
          <AlertTriangle size={10} />
          금리·달러 동반 상승 — 주식 비중 보수적 조절 고려
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
            <Line type="monotone" dataKey="dxy"  name="DXY"    stroke={C.yellow} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  )
}

// ─────────────────────────────────────────────
// 위젯: 시장 건강 상태 (신고가 비율) — Mock
// ─────────────────────────────────────────────
function BreadthWidget() {
  const latest  = BREADTH_DATA[BREADTH_DATA.length - 1]
  const prev    = BREADTH_DATA[BREADTH_DATA.length - 2]
  const ratio   = (latest.highs / (latest.highs + latest.lows) * 100).toFixed(1)
  const healthy = parseFloat(ratio) > 60

  return (
    <Widget title="시장 건강 상태 (신고가 비율)" badge={`${healthy ? '건강' : '약화'} · Mock`}
      badgeColor={healthy ? C.green : C.orange} helpKey="breadth" className="col-span-2">

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
        <span style={{ color: C.yellow }}>▸ 무엇인가요?</span>&nbsp;
        당일 52주 신고가를 경신한 종목 수 vs 신저가 종목 수의 비율.
        지수가 오르더라도 신고가 종목이 줄면 <span style={{ color: C.red }}>소수 대형주만의 착시</span>일 수 있습니다.
        현재 <span style={{ color: C.accent }}>참고용 Mock 데이터</span>입니다.
      </p>

      <div className="flex gap-6">
        <div className="w-40 shrink-0 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>신고가 비율</p>
            <p className="text-2xl font-semibold" style={{ color: healthy ? C.green : C.orange }}>{ratio}%</p>
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
            <div className="flex justify-between border-t pt-1.5" style={{ borderColor: C.border }}>
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
          <svg width="70" height="70" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r="28" fill="none" stroke={C.border} strokeWidth="6" />
            <circle cx="35" cy="35" r="28" fill="none"
              stroke={healthy ? C.green : C.orange} strokeWidth="6"
              strokeDasharray={`${parseFloat(ratio) * 1.759} 175.9`}
              strokeLinecap="round" transform="rotate(-90 35 35)" />
            <text x="35" y="39" textAnchor="middle" fontSize="12" fill={healthy ? C.green : C.orange} fontFamily="monospace">
              {ratio}%
            </text>
          </svg>
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
  const [checklist, setChecklist] = useState(() => {
    try { const s = localStorage.getItem('hemstock_checklist'); return s ? JSON.parse(s) : DEFAULT_CHECKLIST }
    catch { return DEFAULT_CHECKLIST }
  })
  const [journal, setJournal] = useState(() => {
    try { return localStorage.getItem('hemstock_journal') || '' } catch { return '' }
  })
  const [traded, setTraded] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('hemstock_traded') || 'null')
      return s?.date === new Date().toDateString() ? s.value : null
    } catch { return null }
  })
  const [newItem, setNewItem] = useState('')

  const saveChecklist = (list) => { setChecklist(list); localStorage.setItem('hemstock_checklist', JSON.stringify(list)) }
  const toggleCheck   = (id)  => saveChecklist(checklist.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  const removeItem    = (id)  => saveChecklist(checklist.filter(c => c.id !== id))
  const addItem = () => {
    if (!newItem.trim()) return
    saveChecklist([...checklist, { id: `c${Date.now()}`, text: newItem.trim(), checked: false }])
    setNewItem('')
  }
  const saveJournal = (v) => { setJournal(v); localStorage.setItem('hemstock_journal', v) }
  const setTradedVal = (v) => { setTraded(v); localStorage.setItem('hemstock_traded', JSON.stringify({ date: new Date().toDateString(), value: v })) }

  const checked = checklist.filter(c => c.checked).length
  const pct     = checklist.length ? Math.round((checked / checklist.length) * 100) : 0

  return (
    <aside className="w-72 shrink-0 flex flex-col h-screen overflow-hidden border-r" style={{ background: C.header, borderColor: C.border }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
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
        <div className="border-b pb-4" style={{ borderColor: C.border }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>오늘 매매 여부</p>
          <div className="flex gap-2">
            {[
              { label: '매매함', value: 'yes',   color: C.green },
              { label: '안함',   value: 'no',    color: C.muted },
              { label: '관망',   value: 'watch', color: C.yellow },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTradedVal(opt.value)}
                className="flex-1 py-1.5 rounded text-[10px] font-semibold border transition-all"
                style={{
                  borderColor: traded === opt.value ? opt.color : C.border,
                  color:       traded === opt.value ? opt.color : C.muted,
                  background:  traded === opt.value ? opt.color + '15' : 'transparent',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 체크리스트 */}
        <div className="border-b pb-4" style={{ borderColor: C.border }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>매매 기준 체크리스트</p>
            <button onClick={() => saveChecklist(checklist.map(c => ({ ...c, checked: false })))}
              className="text-[9px] hover:text-[#1a73e8] transition-colors" style={{ color: C.muted }}>초기화</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? C.green : C.accent }} />
            </div>
            <span className="text-[10px] shrink-0" style={{ color: pct === 100 ? C.green : C.muted }}>{checked}/{checklist.length}</span>
          </div>
          <div className="space-y-0.5">
            {checklist.map(item => (
              <div key={item.id} className="flex items-center gap-2 py-1.5 group cursor-pointer">
                <button onClick={() => toggleCheck(item.id)} className="shrink-0 transition-colors"
                  style={{ color: item.checked ? C.green : C.muted }}>
                  {item.checked ? <CheckSquare size={13} /> : <Square size={13} />}
                </button>
                <span className="flex-1 text-[11px] leading-tight"
                  style={{ color: item.checked ? C.muted : C.text, textDecoration: item.checked ? 'line-through' : 'none' }}>
                  {item.text}
                </span>
                <button onClick={() => removeItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ color: C.muted }}><X size={10} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-2">
            <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="체크항목 추가..."
              className="flex-1 rounded px-2 py-1 text-[10px] outline-none focus:border-[#1a73e8] placeholder:text-[#5a7080]"
              style={{ background: C.border + '50', border: `1px solid ${C.border}`, color: C.text }} />
            <button onClick={addItem}
              className="px-2 py-1 rounded text-[10px] transition-colors hover:bg-[#1a73e8]/20"
              style={{ color: C.accent, border: `1px solid ${C.accent}30` }}>+</button>
          </div>
        </div>

        {/* 매매 메모 */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>오늘 매매 메모</p>
          <textarea value={journal} onChange={e => saveJournal(e.target.value)}
            placeholder="오늘의 판단 근거, 반성, 배운 점을 기록하세요..."
            rows={8}
            className="w-full rounded px-3 py-2 text-[11px] leading-relaxed outline-none resize-none placeholder:text-[#5a7080]"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          <p className="text-[9px] mt-1" style={{ color: C.muted }}>자동 저장 (LocalStorage)</p>
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────
// 상단 헤더 바 (환율 실시간 반영)
// ─────────────────────────────────────────────
function TopBar() {
  const [time, setTime] = useState(new Date())
  const { data: fxData } = useUsdKrw()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const indices = [
    { name: 'KOSPI',   value: '2,748.32', change: '+0.82%', up: true  },
    { name: 'KOSDAQ',  value: '  856.71', change: '-0.14%', up: false },
    { name: 'S&P500',  value: '5,521.14', change: '+0.31%', up: true  },
    { name: 'NASDAQ',  value: '17,834.23',change: '+0.56%', up: true  },
    {
      name: 'USD/KRW',
      value: fxData?.krw ? `${fxData.krw.toFixed(1)}` : '로딩...',
      change: '',
      up: false,
      isLive: !!fxData,
    },
  ]

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b text-xs shrink-0"
      style={{ background: C.header, borderColor: C.border }}>
      <div className="flex items-center gap-5 flex-wrap">
        {indices.map(idx => (
          <div key={idx.name} className="flex items-center gap-1.5">
            {idx.isLive && <div className="live-dot" />}
            <span style={{ color: C.muted }}>{idx.name}</span>
            <span style={{ color: C.text }}>{idx.value}</span>
            {idx.change && <span style={{ color: idx.up ? C.green : C.red }}>{idx.change}</span>}
            {idx.isLive && <span className="text-[9px]" style={{ color: C.accent }}>LIVE</span>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="live-dot" />
          <span style={{ color: C.muted }}>실시간</span>
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
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-4 auto-rows-min">

            {/* ── 실시간 API 위젯 ───────────────────── */}
            {/* 공포탐욕지수 (2칸) */}
            <FearAndGreedWidget />

            {/* USD/KRW (1칸) + BTC (1칸) */}
            <UsdKrwWidget />
            <BitcoinWidget />

            {/* ── Mock 데이터 위젯 ──────────────────── */}
            {/* VIX (2칸) + 신용잔고 (2칸) */}
            <VixWidget />
            <CreditWidget />

            {/* 국민연금 (2칸, 2행) + 연준 (2칸) */}
            <div className="col-span-2 row-span-2">
              <NpsWidget className="h-full" />
            </div>
            <FedWidget />

            {/* 시장건강 (2칸) */}
            <BreadthWidget />

            {/* 푸터 */}
            <div className="col-span-4 flex items-center justify-between px-1 py-2 text-[10px]"
              style={{ color: C.muted }}>
              <span>
                HemStock v0.2 · GitHub Pages ·
                <span style={{ color: C.green }}> ✓ 실시간</span>: 공포탐욕지수, USD/KRW, BTC (API 키 불필요) ·
                <span style={{ color: C.accent }}> ⟳ 매일 04:00 KST</span>: 국민연금 자동갱신 ·
                <span style={{ color: C.muted }}> Mock</span>: VIX, 신용잔고, 연준, 시장건강
              </span>
              <span>투자 참고용 정보이며 투자 권유가 아닙니다.</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
