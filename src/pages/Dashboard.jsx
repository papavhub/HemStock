import React, {
  useState, useEffect, useRef, useCallback, createContext, useContext,
} from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Info, CheckSquare, Square, RefreshCw, Activity,
  X, AlertTriangle, TrendingUp, TrendingDown, Sun, Moon,
} from 'lucide-react'

// ═══════════════════════════════════════════════════
// 테마 팔레트
// ═══════════════════════════════════════════════════
const DARK = {
  bg:     '#0a0e14', panel:  '#0f1520', border: '#1e2d40',
  header: '#0d1b2a', text:   '#cdd6e0', muted:  '#5a7080',
  accent: '#3b8ff5', green:  '#00c853', red:    '#f44336',
  orange: '#e8860a', yellow: '#ffd600', purple: '#9c27b0',
  isDark: true,
}
const LIGHT = {
  bg:     '#f0f4f9', panel:  '#ffffff', border: '#d5dfe9',
  header: '#e8f0f8', text:   '#1a2638', muted:  '#5a7080',
  accent: '#1558d6', green:  '#15803d', red:    '#b91c1c',
  orange: '#c2410c', yellow: '#92400e', purple: '#6d28d9',
  isDark: false,
}

const ThemeCtx = createContext(LIGHT)
const useC     = () => useContext(ThemeCtx)

// ═══════════════════════════════════════════════════
// 도움말 멘트
// ═══════════════════════════════════════════════════
const HELP = {
  vix:
    '대중과 반대로 행동하세요. VIX가 30 이상 \'극도의 공포\' 구간에 진입할 때는 좋은 주식을 분할 매수할 기회이며, 20 미만 \'안정\' 구간에서는 현금 비중을 점진적으로 확보하는 기준이 됩니다.',
  nps:
    '국민연금은 국내 주식 시장의 최대 기관 투자자(약 100조+)입니다. 매일 새벽 GitHub Actions가 데이터를 갱신하며, 기관이 장기적으로 모아가는 우량주 수급의 뼈대를 확인하는 용도입니다.',
  credit:
    '개인의 \'빚투\' 열기를 보여줍니다. 비율이 전고점을 뚫고 폭발할 때는 단기 꼭지(과열) 확률이 높습니다. 반대로 반대매매로 신용잔고가 급감하면 단기 바닥 신호일 수 있습니다.',
  fed:
    '미 국채 10Y 금리와 달러 인덱스(DXY). 두 지표가 동시에 오르면 위험자산에서 돈이 빠져나가는 신호입니다. 하향 안정화될 때 적극적 매매를 고려하세요.',
  breadth:
    '지수가 오르는데 신고가 종목이 줄면 소수 대형주만 오르는 \'착시 현상\'으로 하락의 전조입니다. 반대로 지수가 지지부진해도 신고가 종목이 늘면 장의 체력이 좋아지는 신호입니다.',
  fng:
    '암호화폐·주식 시장 심리 온도계 (0–100). 25 이하 극도의 공포는 위험자산 매수 기회이고, 75 이상 극도의 탐욕은 차익실현을 고민할 시점입니다. 출처: alternative.me',
  usdkrw:
    '원달러 환율은 외국인 투자자의 한국 주식 매수·매도 의향을 간접적으로 보여줍니다. 1,400원 이상이면 외인 이탈 경계 구간입니다. 출처: ExchangeRate-API (무료 공개)',
  btc:
    '비트코인은 위험자산 선호도의 선행 지표입니다. 24시간 -5% 이하 급락은 주식시장 조정의 전조로 해석합니다. 출처: CoinGecko API (무료, 키 불필요)',
}

// (Mock 데이터 제거 — 전부 JSON 파일에서 읽어옴)

// 기본 체크리스트
const DEFAULT_CHECKLIST = [
  { id: 'c1', text: '공포탐욕지수 확인 (25 이하 = 매수 기회)',       checked: false },
  { id: 'c2', text: 'VIX 수준 확인 (30 이상 = 공포 구간)',           checked: false },
  { id: 'c3', text: '국민연금 포트 방향과 내 보유 종목 비교',         checked: false },
  { id: 'c4', text: '신용잔고 전고점 대비 위치 확인',                 checked: false },
  { id: 'c5', text: '미 국채 금리 + 달러인덱스 방향 확인',           checked: false },
  { id: 'c6', text: '원달러 환율 급등 여부 (외인 이탈 신호)',         checked: false },
  { id: 'c7', text: '비트코인 방향 확인 (위험자산 선호도)',           checked: false },
  { id: 'c8', text: '신고가 종목 수 추세 (이격 여부)',                checked: false },
  { id: 'c9', text: '손절 원칙(-8%) 지켰는가?',                      checked: false },
]

// ═══════════════════════════════════════════════════
// 유틸
// ═══════════════════════════════════════════════════
const fmtNum = (n, d = 0) =>
  n?.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

function getVixStatus(C, val) {
  if (val < 15) return { label: '극도의 탐욕', color: C.red }
  if (val < 20) return { label: '안정',        color: C.green }
  if (val < 30) return { label: '주의',        color: C.orange }
  if (val < 40) return { label: '공포',        color: C.red }
  return             { label: '극도의 공포',  color: C.red }
}
function getFngStatus(C, val) {
  if (val <= 25) return { label: '극도의 공포', color: C.red,    action: '분할 매수 탐색' }
  if (val <= 45) return { label: '공포',        color: C.orange, action: '매수 검토' }
  if (val <= 55) return { label: '중립',        color: C.muted,  action: '관망' }
  if (val <= 75) return { label: '탐욕',        color: C.orange, action: '차익실현 검토' }
  return              { label: '극도의 탐욕', color: C.red,    action: '현금 비중 확대' }
}

// ═══════════════════════════════════════════════════
// 실시간 데이터 훅
// ═══════════════════════════════════════════════════

/** alternative.me — 공포탐욕지수 */
function useFearAndGreed() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('https://api.alternative.me/fng/?limit=8&format=json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData([...(json.data || [])].reverse())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** ExchangeRate-API — 환율 */
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
        krw: json.rates?.KRW, jpy: json.rates?.JPY,
        cny: json.rates?.CNY, eur: json.rates?.EUR,
        updatedAt: json.time_last_update_utc,
      })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** CoinGecko — 비트코인 */
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
      const b    = json.bitcoin
      setData({ usd: b.usd, krw: b.krw, change24h: b.usd_24h_change, capUsd: b.usd_market_cap })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** public/data/market.json — VIX·금리·DXY (GitHub Actions 갱신) */
function useMarketData() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const base = import.meta.env.BASE_URL || '/'
      const res  = await fetch(`${base}data/market.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** public/data/credit.json — 신용잔고 */
function useCreditData() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const base = import.meta.env.BASE_URL || '/'
      const res  = await fetch(`${base}data/credit.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** public/data/breadth.json — 신고가·신저가 */
function useBreadthData() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const base = import.meta.env.BASE_URL || '/'
      const res  = await fetch(`${base}data/breadth.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** public/data/nps.json — 국민연금 */
function useNpsData() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const base = import.meta.env.BASE_URL || '/'
      const res  = await fetch(`${base}data/nps.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

// ═══════════════════════════════════════════════════
// 공통 UI 컴포넌트
// ═══════════════════════════════════════════════════

function HelpPopover({ content }) {
  const C   = useC()
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
        className="p-0.5 transition-colors"
        style={{ color: C.muted }}
        onMouseEnter={e => e.currentTarget.style.color = C.accent}
        onMouseLeave={e => e.currentTarget.style.color = C.muted}>
        <Info size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 w-72 rounded-lg p-3 text-xs leading-relaxed shadow-2xl"
          style={{ background: C.panel, border: `1px solid ${C.accent}`, color: C.text }}>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0" style={{ color: C.accent }}>💡</span>
            <p>{content}</p>
          </div>
          <button onClick={() => setOpen(false)} className="absolute right-2 top-2"
            style={{ color: C.muted }}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

function SourceBadge({ label, url }) {
  const C = useC()
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
      style={{ color: C.muted, borderColor: C.border }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.muted }}>
      📡 {label}
    </a>
  )
}

function Widget({ title, badge, badgeColor, helpKey, source, sourceUrl, children, className = '', isLive = false }) {
  const C = useC()
  return (
    <div className={`flex flex-col rounded-lg overflow-hidden border ${className}`}
      style={{ background: C.panel, borderColor: C.border }}>
      <div className="flex items-center justify-between px-4 py-2 border-b"
        style={{ background: C.header, borderColor: C.border }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: C.muted }}>
            {title}
          </span>
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

function ChartTooltip({ active, payload, label, unit = '' }) {
  const C = useC()
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border px-3 py-2 text-xs shadow-xl"
      style={{ background: C.header, borderColor: C.border, color: C.text }}>
      <p className="mb-1" style={{ color: C.muted }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || C.text }}>
          {p.name}: <span className="font-semibold">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  )
}

function Spinner({ text = '로딩 중...' }) {
  const C = useC()
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs" style={{ color: C.muted }}>
      <RefreshCw size={13} className="animate-spin" />{text}
    </div>
  )
}

function ApiError({ msg, onRetry }) {
  const C = useC()
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-xs" style={{ color: C.red }}>
      <AlertTriangle size={14} />
      <p>오류: {msg}</p>
      <button onClick={onRetry}
        className="px-3 py-1 rounded border text-[10px] transition-colors"
        style={{ borderColor: C.red, color: C.red }}>재시도</button>
    </div>
  )
}

function InfoBox({ children }) {
  const C = useC()
  return (
    <p className="text-[10px] mb-3 leading-relaxed" style={{ color: C.muted }}>
      <span style={{ color: C.orange }}>▸ 무엇인가요?</span>&nbsp;{children}
    </p>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ①: 공포탐욕지수 (실시간 — alternative.me)
// ═══════════════════════════════════════════════════
function FearAndGreedWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useFearAndGreed()
  const latest  = data?.[data.length - 1]
  const val     = latest ? parseInt(latest.value) : null
  const status  = val !== null ? getFngStatus(C, val) : null
  const chartData = (data || []).map(d => ({
    date:  new Date(parseInt(d.timestamp) * 1000).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
    value: parseInt(d.value),
    label: d.value_classification,
  }))
  const gc = status?.color ?? C.muted

  return (
    <Widget title="공포탐욕지수 (실시간)" badge={status?.label} badgeColor={status?.color}
      helpKey="fng" source="alternative.me/fng" sourceUrl="https://alternative.me/crypto/fear-and-greed-index/"
      isLive className="col-span-2">
      <InfoBox>
        암호화폐·주식 시장 심리 온도계. 0에 가까울수록{' '}
        <span style={{ color: C.red }}>공포(매수 기회)</span>, 100에 가까울수록{' '}
        <span style={{ color: C.green }}>탐욕(매도 신호)</span>.
        주식·코인 시장 심리는 높은 상관관계를 보입니다.
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="flex gap-5">
          <div className="w-36 shrink-0 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>현재 지수</p>
              <p className="text-4xl font-bold" style={{ color: gc }}>{val}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: gc }}>{status?.label}</p>
              <span className="inline-block text-[10px] mt-1 px-2 py-0.5 rounded"
                style={{ background: gc + '18', color: gc, border: `1px solid ${gc}30` }}>
                → {status?.action}
              </span>
            </div>
            {/* 아크 게이지 */}
            <svg width="120" height="72" viewBox="0 0 120 72">
              <defs>
                <linearGradient id="fngGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor={C.red} />
                  <stop offset="30%"  stopColor={C.orange} />
                  <stop offset="50%"  stopColor={C.isDark ? C.yellow : '#eab308'} />
                  <stop offset="70%"  stopColor="#65a30d" />
                  <stop offset="100%" stopColor={C.green} />
                </linearGradient>
              </defs>
              <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={C.border} strokeWidth="8" strokeLinecap="round" />
              <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="url(#fngGrad)"
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(val / 100) * 157} 157`} />
              <text x="60" y="60" textAnchor="middle" fontSize="12" fontFamily="monospace"
                fontWeight="bold" fill={gc}>{val}</text>
            </svg>
            {/* 구간 범례 */}
            <div className="space-y-1 text-[9px]">
              {[
                { r: '0–25',   l: '극도의 공포', c: C.red },
                { r: '26–45',  l: '공포',        c: C.orange },
                { r: '46–55',  l: '중립',        c: C.muted },
                { r: '56–75',  l: '탐욕',        c: C.orange },
                { r: '76–100', l: '극도의 탐욕', c: C.green },
              ].map(z => (
                <div key={z.r} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: z.c, display: 'inline-block' }} />
                  <span style={{ color: C.muted }}>{z.r} {z.l}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>최근 8일 추이</p>
            <div className="h-[185px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fngAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={gc} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={gc} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={({ active, payload, label }) =>
                    active && payload?.length
                      ? <div className="rounded border px-2 py-1 text-xs shadow"
                          style={{ background: C.header, borderColor: C.border }}>
                          <p style={{ color: C.muted }}>{label}</p>
                          <p style={{ color: gc }}><b>{payload[0].value}</b> — {payload[0].payload.label}</p>
                        </div>
                      : null
                  } />
                  <ReferenceLine y={25} stroke={C.red}   strokeDasharray="3 3" label={{ value: '공포선', fill: C.red,   fontSize: 9 }} />
                  <ReferenceLine y={75} stroke={C.green} strokeDasharray="3 3" label={{ value: '탐욕선', fill: C.green, fontSize: 9 }} />
                  <Area type="monotone" dataKey="value" name="지수" stroke={gc}
                    fill="url(#fngAreaGrad)" strokeWidth={1.5}
                    dot={{ r: 3, fill: gc }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ②: 원달러 환율 (실시간 — ExchangeRate-API)
// ═══════════════════════════════════════════════════
function UsdKrwWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useUsdKrw()
  const isDanger  = data?.krw >= 1400
  const isWarning = !isDanger && data?.krw >= 1350
  const sc = isDanger ? C.red : isWarning ? C.orange : C.green
  const sl = isDanger ? '위험' : isWarning ? '주의' : '안정'

  return (
    <Widget title="원달러 환율 (실시간)" badge={sl} badgeColor={sc}
      helpKey="usdkrw" source="ExchangeRate-API" sourceUrl="https://open.er-api.com"
      isLive>
      <InfoBox>
        달러 대비 원화 가치. 숫자가 클수록 원화 약세(달러 강세).
        <span style={{ color: C.red }}> 1,400원↑</span>은 외인 이탈 경계 구간입니다.
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>USD / KRW</p>
              <p className="text-3xl font-bold" style={{ color: sc }}>₩ {fmtNum(data.krw, 1)}</p>
            </div>
            {isDanger && (
              <div className="mb-1 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                style={{ background: C.red + '18', color: C.red, border: `1px solid ${C.red}30` }}>
                <AlertTriangle size={9} /> 1,400원 돌파 — 외인 이탈 주의
              </div>
            )}
          </div>
          {/* 구간 해석 */}
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            {[
              { range: '~1,200',     label: '원화 강세',  sub: '외인 유입',    color: C.green },
              { range: '1,200~1,350',label: '보통',       sub: '중립',         color: C.muted },
              { range: '1,350~1,400',label: '원화 약세',  sub: '주의',         color: C.orange },
              { range: '1,400~',     label: '위험',       sub: '외인 이탈',    color: C.red },
            ].map(z => (
              <div key={z.range} className="rounded px-1.5 py-1"
                style={{ background: z.color + '12', border: `1px solid ${z.color}20` }}>
                <p className="font-semibold" style={{ color: z.color }}>{z.range}</p>
                <p style={{ color: z.color }}>{z.label}</p>
                <p style={{ color: C.muted }}>{z.sub}</p>
              </div>
            ))}
          </div>
          {/* 주요 통화 */}
          <div className="border-t pt-2" style={{ borderColor: C.border }}>
            <p className="text-[9px] mb-1" style={{ color: C.muted }}>주요 통화 (기준: 1 USD)</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { l: 'USD/JPY', v: fmtNum(data.jpy, 2), u: '엔' },
                { l: 'USD/CNY', v: fmtNum(data.cny, 4), u: '위안' },
                { l: 'USD/EUR', v: fmtNum(data.eur, 4), u: '유로' },
              ].map(c => (
                <div key={c.l} className="flex justify-between">
                  <span className="text-[10px]" style={{ color: C.muted }}>{c.l}</span>
                  <span className="text-[10px] font-semibold" style={{ color: C.text }}>{c.v} {c.u}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] mt-2" style={{ color: C.muted }}>
              기준: {data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR') : '—'}
            </p>
          </div>
        </div>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ③: 비트코인 (실시간 — CoinGecko)
// ═══════════════════════════════════════════════════
function BitcoinWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useBitcoin()
  const change = data?.change24h ?? 0
  const isUp   = change >= 0
  const cc     = isUp ? C.green : C.red
  const signal = change <= -5
    ? { label: '⚠ 위험자산 기피', color: C.red }
    : change >= 5
      ? { label: '위험자산 선호↑', color: C.green }
      : null

  return (
    <Widget title="비트코인 (위험자산 선호도)" badge={signal?.label} badgeColor={signal?.color}
      helpKey="btc" source="CoinGecko API" sourceUrl="https://www.coingecko.com/en/api"
      isLive>
      <InfoBox>
        비트코인은 위험자산 선호도의 선행 지표.
        <span style={{ color: C.red }}> 24h -5%↓</span>는 주식 조정의 전조 신호로 활용합니다.
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>BTC / USD</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold" style={{ color: C.text }}>${fmtNum(data.usd)}</p>
              <div className="mb-0.5 flex items-center gap-1">
                {isUp ? <TrendingUp size={13} color={cc} /> : <TrendingDown size={13} color={cc} />}
                <span className="text-sm font-semibold" style={{ color: cc }}>
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </span>
                <span className="text-[10px]" style={{ color: C.muted }}>24h</span>
              </div>
            </div>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>≈ ₩{fmtNum(data.krw)}</p>
          </div>
          {/* 시가총액 */}
          <div className="rounded px-3 py-2" style={{ background: C.border + '60' }}>
            <p className="text-[10px]" style={{ color: C.muted }}>시가총액</p>
            <p className="text-sm font-semibold" style={{ color: C.text }}>
              ${(data.capUsd / 1e12).toFixed(2)}조 USD
            </p>
          </div>
          {/* 시그널 기준 */}
          <div className="space-y-1 text-[10px]">
            <p style={{ color: C.muted }}>📊 시그널 해석 기준</p>
            {[
              { cond: '+5%↑',  label: '위험자산 매수세 강함',         color: C.green },
              { cond: '±5%',   label: '중립 / 방향성 탐색',           color: C.muted },
              { cond: '-5%↓',  label: '위험자산 기피 시작',           color: C.orange },
              { cond: '-10%↓', label: '강한 위험 회피 → 비중 축소 검토', color: C.red },
            ].map(s => (
              <div key={s.cond} className="flex items-center gap-2">
                <span className="font-mono w-10 shrink-0" style={{ color: s.color }}>{s.cond}</span>
                <span style={{ color: C.muted }}>{s.label}</span>
              </div>
            ))}
          </div>
          {/* 변동 바 */}
          <div>
            <p className="text-[9px] mb-1" style={{ color: C.muted }}>24시간 변동 위치 (±10% 기준)</p>
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div className="absolute h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(Math.abs(change) / 10 * 50, 50)}%`,
                  left:  isUp ? '50%' : `${50 - Math.min(Math.abs(change) / 10 * 50, 50)}%`,
                  background: cc,
                }} />
              <div className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: C.muted }} />
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

// ═══════════════════════════════════════════════════
// 위젯 ④: VIX 공포지수 (GitHub Actions — yfinance)
// ═══════════════════════════════════════════════════
function VixWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useMarketData()
  const vix    = data?.vix
  const series = vix?.series ?? []
  const latest = vix?.latest
  const prev   = vix?.prev
  const up     = latest > prev
  const status = latest !== null && latest !== undefined ? getVixStatus(C, latest) : null
  const pct    = latest ? Math.min((latest / 80) * 100, 100) : 0

  return (
    <Widget title="공포지수 (VIX)" badge={status?.label} badgeColor={status?.color}
      source="Yahoo Finance (^VIX)" sourceUrl="https://finance.yahoo.com/quote/%5EVIX/"
      helpKey="vix" className="col-span-2">
      <InfoBox>
        S&P500 옵션 가격으로 산출하는 시장 변동성 지수.
        <span style={{ color: C.red }}> 30 이상 = 공포</span>,
        <span style={{ color: C.green }}> 20 미만 = 안정</span>.
        매일 새벽 GitHub Actions (yfinance)가 자동 갱신합니다.
        {data?.updated_at && <span style={{ color: C.muted }}> · 갱신: {data.updated_at}</span>}
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="flex gap-6">
          <div className="w-32 shrink-0 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>현재 VIX</p>
              <p className="text-2xl font-semibold" style={{ color: status?.color ?? C.text }}>
                {latest?.toFixed(1) ?? '—'}
              </p>
              {prev && (
                <p className="text-xs mt-0.5" style={{ color: up ? C.red : C.green }}>
                  {up ? '▲' : '▼'} {Math.abs(vix.change ?? 0).toFixed(2)} 전일比
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] mb-1" style={{ color: C.muted }}>공포 게이지</p>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: C.border }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg,${C.green},${C.orange},${C.red})` }} />
              </div>
              <div className="flex justify-between text-[9px] mt-0.5" style={{ color: C.muted }}>
                <span>0</span><span>20</span><span>40</span><span>80</span>
              </div>
            </div>
            <div className="space-y-1 text-[10px]">
              {[
                { label: '<15 극도탐욕', color: C.red },
                { label: '15–20 안정',  color: C.green },
                { label: '20–30 주의',  color: C.orange },
                { label: '>30 공포',    color: C.red },
              ].map(z => (
                <div key={z.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm shrink-0 inline-block" style={{ background: z.color }} />
                  <span style={{ color: C.muted }}>{z.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="vixGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={status?.color ?? C.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={status?.color ?? C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={30} stroke={C.red}   strokeDasharray="4 4" label={{ value: '공포선 30', fill: C.red,   fontSize: 9, position: 'insideTopLeft' }} />
                <ReferenceLine y={20} stroke={C.green} strokeDasharray="4 4" label={{ value: '안정선 20', fill: C.green, fontSize: 9, position: 'insideTopLeft' }} />
                <Area type="monotone" dataKey="value" name="VIX"
                  stroke={status?.color ?? C.accent} fill="url(#vixGrad)"
                  strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ⑤: 국민연금 포트폴리오 (GitHub Actions — NPS)
// ═══════════════════════════════════════════════════
function NpsWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useNpsData()
  const stocks = data?.stocks ?? []

  return (
    <Widget title="국민연금 포트폴리오" badge="NPS · GitHub Actions" badgeColor={C.accent}
      helpKey="nps" source="공시 기반 자동수집" sourceUrl="https://github.com/papavhub/HemStock/actions"
      className="col-span-2 row-span-2">
      <InfoBox>
        국민연금은 국내 최대 기관 투자자(약 100조+). 매일 새벽 4시 GitHub Actions가 자동 갱신.
        이들이 장기 보유하는 종목 방향성과 내 포트폴리오를 비교하세요.
      </InfoBox>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px]" style={{ color: C.muted }}>
          업데이트: <span style={{ color: C.text }}>{data?.updated_at ?? '—'}</span>
          {error && <span className="ml-2" style={{ color: C.orange }}>⚠ {error}</span>}
        </div>
        <button onClick={refetch} disabled={loading}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors"
          style={{ color: C.muted, borderColor: C.border }}>
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>
      {loading ? <Spinner /> : (
        <div className="flex gap-4">
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
                  <tr key={s.rank} className="border-b transition-colors"
                    style={{ borderColor: C.border + '50' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.border + '30'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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
                    ? <div className="rounded border px-2 py-1 text-xs"
                        style={{ background: C.header, borderColor: C.border }}>
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

// ═══════════════════════════════════════════════════
// 위젯 ⑥: 연준 방향성 (GitHub Actions — yfinance)
// ═══════════════════════════════════════════════════
function FedWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useMarketData()
  const tnx    = data?.treasury_10y
  const dxy    = data?.dxy
  const rateUp = (tnx?.change ?? 0) > 0
  const dxyUp  = (dxy?.change ?? 0) > 0
  const danger = rateUp && dxyUp

  // 차트: 금리와 DXY를 같은 날짜로 병합
  const fedChart = (() => {
    const tnxMap = {}
    ;(tnx?.series ?? []).forEach(d => { tnxMap[d.date] = d.value })
    return (dxy?.series ?? []).map(d => ({
      date: d.date,
      dxy:  d.value,
      rate: tnxMap[d.date] ?? null,
    })).filter(d => d.rate !== null).slice(-20) // 최근 20일
  })()

  return (
    <Widget title="연준(Fed) 방향성 / 매크로"
      badge={danger ? '⚠ 위험자산 주의' : '안정'} badgeColor={danger ? C.red : C.green}
      helpKey="fed" source="Yahoo Finance (^TNX · DX-Y.NYB)"
      sourceUrl="https://finance.yahoo.com/quote/%5ETNX/" className="col-span-2">
      <InfoBox>
        미 국채 10Y 금리(채권 시장 기준)와 달러 인덱스(DXY).
        <span style={{ color: C.red }}> 두 지표 동반 상승</span> = 주식에서 채권·달러로 돈 이동.
        매일 새벽 GitHub Actions (yfinance)가 자동 갱신합니다.
        {data?.updated_at && <span style={{ color: C.muted }}> · 갱신: {data.updated_at}</span>}
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>미 국채 10Y 금리</p>
              <p className="text-xl font-semibold" style={{ color: rateUp ? C.red : C.green }}>
                {tnx?.latest?.toFixed(2) ?? '—'}%
              </p>
              <p className="text-[10px]" style={{ color: rateUp ? C.red : C.green }}>
                {rateUp ? '▲ 상승 (채권매도·주식부담)' : '▼ 하락 (주식 우호적)'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>달러 인덱스 (DXY)</p>
              <p className="text-xl font-semibold" style={{ color: dxyUp ? C.red : C.green }}>
                {dxy?.latest?.toFixed(2) ?? '—'}
              </p>
              <p className="text-[10px]" style={{ color: dxyUp ? C.red : C.green }}>
                {dxyUp ? '▲ 강달러 (신흥국 자금 이탈)' : '▼ 약달러 (위험자산 선호)'}
              </p>
            </div>
          </div>
          {danger && (
            <div className="mb-2 flex items-center gap-1.5 rounded border px-2 py-1.5 text-[10px]"
              style={{ color: C.red, borderColor: C.red + '40', background: C.red + '10' }}>
              <AlertTriangle size={10} />
              금리·달러 동반 상승 — 주식 비중 보수적 조절 고려
            </div>
          )}
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fedChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="rate" name="금리(%)" stroke={C.accent} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="dxy"  name="DXY"    stroke={C.orange}  strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ⑦: 신용잔고 비율 (GitHub Actions — KRX/KOFIA)
// ═══════════════════════════════════════════════════
function CreditWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useCreditData()

  const latest = data?.latest ?? null
  const prev   = data?.prev   ?? null
  const peak   = data?.peak   ?? null
  const change = data?.change ?? 0
  const series = data?.series ?? []
  const up     = change > 0

  // 전고점 대비 위치
  const toPeak = peak && latest ? ((latest / peak) * 100).toFixed(0) : null

  return (
    <Widget title="신용잔고 비율" badge={up ? '▲ 상승' : '▼ 하락'} badgeColor={up ? C.orange : C.green}
      helpKey="credit" source={data?.source?.includes('fallback') ? 'KRX/KOFIA · fallback' : 'KRX 정보데이터시스템'}
      sourceUrl="https://data.krx.co.kr" className="col-span-2">
      <InfoBox>
        증권사에서 빌린 돈으로 주식을 산 금액의 시장 비율.
        <span style={{ color: C.red }}> 전고점 돌파 시 과열 신호</span>,
        급감 시 반대매매 바닥 신호. 매일 새벽 GitHub Actions가 KRX에서 자동 갱신합니다.
        {data?.updated_at && <span style={{ color: C.muted }}> · 갱신: {data.updated_at}</span>}
      </InfoBox>

      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <>
          <div className="flex items-start gap-4 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>신용잔고 비율</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-semibold" style={{ color: up ? C.orange : C.green }}>
                  {latest?.toFixed(2) ?? '—'}%
                </p>
                <p className="text-xs mb-1" style={{ color: up ? C.red : C.green }}>
                  {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                </p>
              </div>
            </div>
            {peak && (
              <div className="ml-auto text-right">
                <p className="text-[10px]" style={{ color: C.muted }}>전고점</p>
                <p className="text-lg font-semibold" style={{ color: C.red }}>{peak.toFixed(2)}%</p>
                <p className="text-[10px]" style={{ color: toPeak >= 90 ? C.red : C.muted }}>
                  현재 {toPeak}% 수준
                </p>
              </div>
            )}
          </div>

          {/* 전고점 대비 게이지 */}
          {peak && latest && (
            <div className="mb-3">
              <div className="flex justify-between text-[9px] mb-0.5" style={{ color: C.muted }}>
                <span>0%</span>
                <span style={{ color: C.red }}>전고점 {peak.toFixed(2)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((latest / peak) * 100, 100)}%`,
                    background: toPeak >= 90 ? C.red : toPeak >= 70 ? C.orange : C.green,
                  }} />
              </div>
            </div>
          )}

          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.orange} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.orange} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip unit="%" />} />
                {peak && <ReferenceLine y={peak} stroke={C.red} strokeDasharray="4 4"
                  label={{ value: '전고점', fill: C.red, fontSize: 9 }} />}
                <Area type="monotone" dataKey="ratio" name="신용잔고" stroke={C.orange}
                  fill="url(#creditGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ⑧: 시장 건강 상태 (GitHub Actions — yfinance KOSPI 80종목)
// ═══════════════════════════════════════════════════
function BreadthWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useBreadthData()

  const latest  = data?.latest  ?? null
  const series  = data?.series  ?? []
  const ratio   = latest?.ratio ?? null
  const healthy = ratio !== null && ratio > 60

  const prev = series.length >= 2 ? series[series.length - 2] : null
  const highChange = latest && prev ? latest.highs - prev.highs : null

  return (
    <Widget title="시장 건강 상태 (신고가 비율)" badge={healthy ? '건강' : '약화'} badgeColor={healthy ? C.green : C.orange}
      helpKey="breadth" source="Yahoo Finance · KOSPI 주요주 80종목"
      sourceUrl="https://finance.yahoo.com" className="col-span-2">
      <InfoBox>
        KOSPI 주요 80개 종목 중 52주 신고가 경신 종목 수 비율.
        <span style={{ color: C.red }}> 지수↑ + 신고가↓ = 소수 대형주 착시</span> (하락 전조).
        매일 새벽 GitHub Actions (yfinance)가 자동 갱신합니다.
        {data?.updated_at && <span style={{ color: C.muted }}> · 갱신: {data.updated_at}</span>}
      </InfoBox>

      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="flex gap-6">
          <div className="w-40 shrink-0 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>신고가 비율</p>
              <p className="text-2xl font-semibold" style={{ color: healthy ? C.green : C.orange }}>
                {ratio?.toFixed(1) ?? '—'}%
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                대상 {latest?.total ?? 0}종목 기준
              </p>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: C.green }}>신고가 근접</span>
                <span className="font-semibold" style={{ color: C.green }}>{latest?.highs ?? '—'}개</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: C.red }}>신저가 근접</span>
                <span className="font-semibold" style={{ color: C.red }}>{latest?.lows ?? '—'}개</span>
              </div>
              {highChange !== null && (
                <div className="flex justify-between border-t pt-1.5" style={{ borderColor: C.border }}>
                  <span style={{ color: C.muted }}>전일比 신고가</span>
                  <span style={{ color: highChange >= 0 ? C.green : C.red }}>
                    {highChange >= 0 ? '+' : ''}{highChange}개
                  </span>
                </div>
              )}
            </div>
            {/* 원형 게이지 */}
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="28" fill="none" stroke={C.border} strokeWidth="6" />
              <circle cx="35" cy="35" r="28" fill="none"
                stroke={healthy ? C.green : C.orange} strokeWidth="6"
                strokeDasharray={`${(ratio ?? 0) * 1.759} 175.9`}
                strokeLinecap="round" transform="rotate(-90 35 35)" />
              <text x="35" y="39" textAnchor="middle" fontSize="12"
                fill={healthy ? C.green : C.orange} fontFamily="monospace">
                {ratio?.toFixed(0) ?? '—'}%
              </text>
            </svg>
          </div>
          <div className="flex-1 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.slice(-10)} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
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
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 사이드바
// ═══════════════════════════════════════════════════
function Sidebar() {
  const C = useC()
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
  const toggleCheck   = (id)   => saveChecklist(checklist.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  const removeItem    = (id)   => saveChecklist(checklist.filter(c => c.id !== id))
  const addItem = () => {
    if (!newItem.trim()) return
    saveChecklist([...checklist, { id: `c${Date.now()}`, text: newItem.trim(), checked: false }])
    setNewItem('')
  }
  const saveJournal  = (v) => { setJournal(v); localStorage.setItem('hemstock_journal', v) }
  const setTradedVal = (v) => { setTraded(v); localStorage.setItem('hemstock_traded', JSON.stringify({ date: new Date().toDateString(), value: v })) }

  const checked = checklist.filter(c => c.checked).length
  const pct     = checklist.length ? Math.round((checked / checklist.length) * 100) : 0

  return (
    <aside className="w-72 shrink-0 flex flex-col h-screen overflow-hidden border-r"
      style={{ background: C.header, borderColor: C.border }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: C.accent }} />
          <h1 className="text-sm font-semibold tracking-wider" style={{ color: C.text }}>HemStock</h1>
        </div>
        <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>매매기준 모니터링 대시보드</p>
        <p className="text-[10px]" style={{ color: C.muted }}>
          {new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', weekday:'short' })}
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
              { label: '관망',   value: 'watch', color: C.orange },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTradedVal(opt.value)}
                className="flex-1 py-1.5 rounded text-[10px] font-semibold border transition-all"
                style={{
                  borderColor: traded === opt.value ? opt.color : C.border,
                  color:       traded === opt.value ? opt.color : C.muted,
                  background:  traded === opt.value ? opt.color + '18' : 'transparent',
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
              className="text-[9px] transition-colors"
              style={{ color: C.muted }}
              onMouseEnter={e => e.currentTarget.style.color = C.accent}
              onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              초기화
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? C.green : C.accent }} />
            </div>
            <span className="text-[10px] shrink-0" style={{ color: pct === 100 ? C.green : C.muted }}>
              {checked}/{checklist.length}
            </span>
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
                  style={{ color: C.muted }}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-2">
            <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="체크항목 추가..."
              className="flex-1 rounded px-2 py-1 text-[10px] outline-none placeholder:text-[#9ca3af]"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
            <button onClick={addItem}
              className="px-2 py-1 rounded text-[10px] transition-colors"
              style={{ color: C.accent, border: `1px solid ${C.accent}40` }}>+</button>
          </div>
        </div>

        {/* 매매 메모 */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>오늘 매매 메모</p>
          <textarea value={journal} onChange={e => saveJournal(e.target.value)}
            placeholder="오늘의 판단 근거, 반성, 배운 점..."
            rows={8}
            className="w-full rounded px-3 py-2 text-[11px] leading-relaxed outline-none resize-none placeholder:text-[#9ca3af]"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          <p className="text-[9px] mt-1" style={{ color: C.muted }}>자동 저장 (LocalStorage)</p>
        </div>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════════════════
// 상단 헤더 바
// ═══════════════════════════════════════════════════
function TopBar({ isDark, toggleTheme }) {
  const C = useC()
  const { data: fxData } = useUsdKrw()
  const [time, setTime] = useState(new Date())
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
      change: '', up: false, isLive: !!fxData,
    },
  ]

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b text-xs shrink-0"
      style={{ background: C.header, borderColor: C.border }}>
      <div className="flex items-center gap-4 flex-wrap">
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
        {/* 테마 토글 */}
        <button onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] transition-all"
          style={{ borderColor: C.border, color: C.muted, background: C.panel }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.muted }}>
          {isDark ? <Sun size={12} /> : <Moon size={12} />}
          {isDark ? '라이트' : '다크'}
        </button>
      </div>
    </header>
  )
}

// ═══════════════════════════════════════════════════
// 메인 대시보드
// ═══════════════════════════════════════════════════
export default function Dashboard() {
  // 기본값: 라이트 모드
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('hemstock_theme') === 'dark' }
    catch { return false }
  })
  const toggleTheme = () => {
    setIsDark(v => {
      const next = !v
      localStorage.setItem('hemstock_theme', next ? 'dark' : 'light')
      return next
    })
  }
  const C = isDark ? DARK : LIGHT

  return (
    <ThemeCtx.Provider value={C}>
      <div className="flex h-screen overflow-hidden"
        style={{ background: C.bg, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar isDark={isDark} toggleTheme={toggleTheme} />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-4 auto-rows-min">

              {/* ── 실시간 API (키 불필요) ─── */}
              <FearAndGreedWidget />   {/* col-span-2 */}
              <UsdKrwWidget />
              <BitcoinWidget />

              {/* ── GitHub Actions 갱신 ──────── */}
              <VixWidget />            {/* col-span-2 */}
              <CreditWidget />         {/* col-span-2 */}

              {/* NPS (2col × 2row) + Fed (2col) */}
              <div className="col-span-2 row-span-2">
                <NpsWidget className="h-full" />
              </div>
              <FedWidget />            {/* col-span-2 */}

              {/* 신고가 비율 */}
              <BreadthWidget />        {/* col-span-2 */}

              {/* 푸터 */}
              <div className="col-span-4 flex items-center justify-between px-1 py-2 text-[10px]"
                style={{ color: C.muted }}>
                <span>
                  HemStock v0.4 ·
                  <span style={{ color: C.green }}> ✓ 실시간</span>: 공포탐욕지수·USD/KRW·BTC ·
                  <span style={{ color: C.accent }}> ⟳ 매일 04:00 KST</span>: VIX·금리·DXY·국민연금·신용잔고·신고가
                </span>
                <span>투자 참고용이며 투자 권유가 아닙니다.</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ThemeCtx.Provider>
  )
}
