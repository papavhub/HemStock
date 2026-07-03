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
  fed:
    '한·미 국채 금리와 달러 인덱스(DXY). 미국 10Y 금리·달러가 동시에 오르면 위험자산에서 돈이 빠져나가는 신호입니다. 한미 금리차(KR-US)가 마이너스면 외인 자본 이탈 압력이 높아집니다.',
  breadth:
    '지수가 오르는데 신고가 종목이 줄면 소수 대형주만 오르는 \'착시 현상\'으로 하락의 전조입니다. 반대로 지수가 지지부진해도 신고가 종목이 늘면 장의 체력이 좋아지는 신호입니다.',
  cnnfng:
    'CNN Fear & Greed Index — 주식 전용 심리 온도계. VIX·풋콜비율·주가 모멘텀·정크본드 스프레드 등 7가지 지표를 종합합니다. 25 이하 극도의 공포는 주식 매수 기회, 75 이상 극도의 탐욕은 차익실현 신호입니다. 출처: CNN Markets',
  krfng:
    '한국 주식시장 공포탐욕지수 — KOSPI 모멘텀(MA20 이격도)·KOSDAQ 상대강도·신고가 비율·VIX 역수·수익률 곡선(KR10Y-KR3Y) 5가지를 가중합산한 자체 복합 지수입니다. 공식 지수가 아닌 참고용 지표이며, 25 이하 극도의 공포 = 분할 매수 탐색, 75 이상 극도의 탐욕 = 차익실현 검토. 출처: Yahoo Finance · 한국은행 ECOS · KOSPI 주요 80종목',
  fng:
    '비트코인 기반 암호화폐 심리 온도계 (0–100). 25 이하 극도의 공포는 코인 매수 기회이고, 75 이상 극도의 탐욕은 매도 신호입니다. 주식 시장과 높은 상관관계를 보입니다. 출처: alternative.me',
  usdkrw:
    '원달러 환율은 외국인 투자자의 한국 주식 매수·매도 의향을 간접적으로 보여줍니다. 1,400원 이상이면 외인 이탈 경계 구간입니다. 출처: ExchangeRate-API (무료 공개)',
  btc:
    '비트코인은 위험자산 선호도의 선행 지표입니다. 24시간 -5% 이하 급락은 주식시장 조정의 전조로 해석합니다. 출처: CoinGecko API (무료, 키 불필요)',
  indices:
    '주요 4개 지수 3개월 추이. KOSPI·KOSDAQ는 한국장, S&P500·NASDAQ는 미국장의 체력을 보여줍니다. 지수 간 격차(디커플링)가 생기면 수급 쏠림 신호입니다.',
  gold:
    '금은 전통적인 안전자산입니다. 금리 하락·달러 약세 구간에서 강세를 보이며, 급등할 때는 시장 불확실성이 높다는 신호입니다. 매일 새벽 yfinance로 자동 갱신합니다.',
}


// 기본 체크리스트
const DEFAULT_CHECKLIST = [
  { id: 'c1', text: '공포탐욕지수 확인 (25 이하 = 매수 기회)',       checked: false },
  { id: 'c2', text: 'VIX 수준 확인 (30 이상 = 공포 구간)',           checked: false },
  { id: 'c3', text: '국민연금 포트 방향과 내 보유 종목 비교',         checked: false },
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

/** CNN Markets — 주식 공포탐욕지수 */
function useCnnFng() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
        headers: { 'Referer': 'https://www.cnn.com/markets/fear-and-greed' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const fg   = json.fear_and_greed
      const hist = (json.fear_and_greed_historical?.data ?? []).slice(-8).map(d => ({
        date:   new Date(d.x).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
        value:  Math.round(d.y),
        rating: d.rating,
      }))
      // 7개 구성 지표 파싱
      const compDefs = [
        { key: 'market_momentum_sp500', label: 'S&P500 모멘텀',    icon: '📈' },
        { key: 'stock_price_strength',  label: '주가 강도',         icon: '💪' },
        { key: 'stock_price_breadth',   label: '주가 폭',           icon: '🌊' },
        { key: 'put_call_options',      label: '풋/콜 비율',        icon: '⚖️' },
        { key: 'market_volatility_vix', label: 'VIX 변동성',        icon: '😰' },
        { key: 'junk_bond_demand',      label: '정크본드 수요',     icon: '🏚️' },
        { key: 'safe_haven_demand',     label: '안전자산 수요',     icon: '🛡️' },
      ]
      const components = compDefs.map(({ key, label, icon }) => {
        const c = json[key] ?? {}
        return { label, icon, score: c.score != null ? Math.round(c.score) : null, rating: c.rating ?? null }
      })
      setData({
        score:    Math.round(fg.score),
        rating:   fg.rating,
        prev1w:   Math.round(fg.previous_1_week),
        prev1m:   Math.round(fg.previous_1_month),
        prev1y:   Math.round(fg.previous_1_year),
        hist,
        components,
        timestamp: fg.timestamp,
      })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}

/** alternative.me — 코인 공포탐욕지수 */
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

function Widget({ title, badge, badgeColor, helpKey, source, sourceUrl, source2, sourceUrl2, children, className = '', isLive = false }) {
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
          {source  && <SourceBadge label={source}  url={sourceUrl}  />}
          {source2 && <SourceBadge label={source2} url={sourceUrl2} />}
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

/** 반원 게이지 — 바늘 + 그라데이션 색상 밴드 */
function GaugeMeter({ value, uid = 'gauge' }) {
  const C = useC()
  if (value == null) return null
  const status = getFngStatus(C, value)
  const gc = status.color
  // arc: center (60,65), r=50, from (10,65) to (110,65) going UP
  // angle: 0 → left(fear), 100 → right(greed)
  const theta = Math.PI * (1 - value / 100)
  const nx = (60 + 42 * Math.cos(theta)).toFixed(1)
  const ny = (65 - 42 * Math.sin(theta)).toFixed(1)

  return (
    <svg width="120" height="72" viewBox="0 0 120 72">
      <defs>
        <linearGradient id={`${uid}BandGrad`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={C.red}    stopOpacity="0.7" />
          <stop offset="25%"  stopColor={C.orange} stopOpacity="0.7" />
          <stop offset="50%"  stopColor={C.isDark ? C.yellow : '#eab308'} stopOpacity="0.7" />
          <stop offset="75%"  stopColor="#65a30d"  stopOpacity="0.7" />
          <stop offset="100%" stopColor={C.green}  stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* 배경 트랙 */}
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none"
        stroke={C.border} strokeWidth="11" strokeLinecap="round" />
      {/* 색상 밴드 (항상 전체 표시, 배경으로) */}
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none"
        stroke={`url(#${uid}BandGrad)`} strokeWidth="11" strokeLinecap="round" opacity="0.4" />
      {/* 진행 아크 (0 → 현재값) */}
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none"
        stroke={gc} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * 157} 157`} />
      {/* 바늘 */}
      <line x1="60" y1="65" x2={nx} y2={ny}
        stroke={C.panel} strokeWidth="2.5" strokeLinecap="round" />
      {/* 중심 점 */}
      <circle cx="60" cy="65" r="5" fill={gc} />
      <circle cx="60" cy="65" r="2.5" fill={C.panel} />
      {/* 구간 레이블 */}
      <text x="13" y="72" fontSize="7" fill={C.red}    fontFamily="monospace">공포</text>
      <text x="90" y="72" fontSize="7" fill={C.green}  fontFamily="monospace">탐욕</text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ①-A: 주식 공포탐욕지수 (실시간 — CNN Markets)
// ═══════════════════════════════════════════════════
function CnnFngWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useCnnFng()
  const val    = data?.score ?? null
  const status = val !== null ? getFngStatus(C, val) : null
  const gc     = status?.color ?? C.muted

  const RATING_KO = {
    'extreme fear': '극도의 공포',
    'fear':         '공포',
    'neutral':      '중립',
    'greed':        '탐욕',
    'extreme greed':'극도의 탐욕',
  }

  return (
    <Widget title="주식 공포탐욕지수 (실시간)" badge={status?.label} badgeColor={status?.color}
      helpKey="cnnfng" source="CNN Fear & Greed Index" sourceUrl="https://www.cnn.com/markets/fear-and-greed"
      isLive className="col-span-2">
      <InfoBox>
        <span style={{ color: C.accent }}>주식 시장 전용</span> 심리 온도계.
        VIX·풋콜비율·주가 모멘텀·정크본드 스프레드 등 7가지 지표 종합.{' '}
        <span style={{ color: C.red }}>25 이하 = 주식 매수 기회</span>,{' '}
        <span style={{ color: C.green }}>75 이상 = 차익실현 신호</span>.
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="flex gap-5">
          {/* 좌측 수치 */}
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
            {/* 반원 게이지 */}
            <GaugeMeter value={val} uid="cnn" />
            {/* 과거 비교 */}
            <div className="space-y-1 text-[10px]">
              {[
                { label: '1주 전', v: data.prev1w },
                { label: '1달 전', v: data.prev1m },
                { label: '1년 전', v: data.prev1y },
              ].map(r => {
                const rs = getFngStatus(C, r.v)
                return (
                  <div key={r.label} className="flex items-center justify-between">
                    <span style={{ color: C.muted }}>{r.label}</span>
                    <span className="font-semibold" style={{ color: rs.color }}>{r.v} {rs.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {/* 우측: 차트 + 7개 구성 지표 */}
          <div className="flex-1 flex flex-col gap-3">
            <div>
              <p className="text-[10px] mb-1" style={{ color: C.muted }}>최근 8일 추이</p>
              <div className="h-[110px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.hist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cnnAreaGrad" x1="0" y1="0" x2="0" y2="1">
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
                            <p style={{ color: gc }}><b>{payload[0].value}</b> — {RATING_KO[payload[0].payload.rating] ?? payload[0].payload.rating}</p>
                          </div>
                        : null
                    } />
                    <ReferenceLine y={25} stroke={C.red}   strokeDasharray="3 3" label={{ value: '공포선', fill: C.red,   fontSize: 9 }} />
                    <ReferenceLine y={75} stroke={C.green} strokeDasharray="3 3" label={{ value: '탐욕선', fill: C.green, fontSize: 9 }} />
                    <Area type="monotone" dataKey="value" name="지수" stroke={gc}
                      fill="url(#cnnAreaGrad)" strokeWidth={1.5}
                      dot={{ r: 3, fill: gc }} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* 7개 구성 지표 */}
            {data.components?.length > 0 && (
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: C.muted }}>7개 구성 지표</p>
                <div className="grid grid-cols-1 gap-0.5">
                  {data.components.map(comp => {
                    const cs = comp.score != null ? getFngStatus(C, comp.score) : null
                    const barW = comp.score != null ? comp.score : 0
                    return (
                      <div key={comp.label} className="flex items-center gap-2">
                        <span className="text-[10px] w-28 shrink-0" style={{ color: C.muted }}>
                          {comp.icon} {comp.label}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${barW}%`, background: cs?.color ?? C.muted }} />
                        </div>
                        <span className="text-[10px] w-6 text-right tabular-nums shrink-0"
                          style={{ color: cs?.color ?? C.muted }}>
                          {comp.score ?? '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ①-B: 코인 공포탐욕지수 (실시간 — alternative.me)
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
    <Widget title="코인 공포탐욕지수 (실시간)" badge={status?.label} badgeColor={status?.color}
      helpKey="fng" source="alternative.me/fng" sourceUrl="https://alternative.me/crypto/fear-and-greed-index/"
      isLive className="col-span-2">
      <InfoBox>
        <span style={{ color: C.orange }}>비트코인 기반</span> 암호화폐 심리 온도계. 0에 가까울수록{' '}
        <span style={{ color: C.red }}>공포(코인 매수 기회)</span>, 100에 가까울수록{' '}
        <span style={{ color: C.green }}>탐욕(매도 신호)</span>.
        주식 시장과 높은 상관관계를 보입니다.
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
            {/* 반원 게이지 */}
            <GaugeMeter value={val} uid="fng" />
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
  const { data: mkt } = useMarketData()
  const isDanger  = data?.krw >= 1400
  const isWarning = !isDanger && data?.krw >= 1350
  const sc = isDanger ? C.red : isWarning ? C.orange : C.green
  const sl = isDanger ? '위험' : isWarning ? '주의' : '안정'
  const krwSeries = (mkt?.usdkrw?.series ?? []).slice(-30)

  return (
    <Widget title="원달러 환율 (실시간)" badge={sl} badgeColor={sc}
      helpKey="usdkrw" source="ExchangeRate-API" sourceUrl="https://open.er-api.com"
      source2="Yahoo Finance (추세)" sourceUrl2="https://finance.yahoo.com/quote/KRW%3DX/"
      isLive className="col-span-2">
      <InfoBox>
        달러 대비 원화 가치. 숫자가 클수록 원화 약세(달러 강세).
        <span style={{ color: C.red }}> 1,400원↑</span>은 외인 이탈 경계 구간입니다.
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="flex gap-5">
          {/* 좌측: 현재값 + 구간 해석 + 주요 통화 */}
          <div className="w-52 shrink-0 space-y-3">
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>USD / KRW</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold" style={{ color: sc }}>₩ {fmtNum(data.krw, 1)}</p>
                  {mkt?.usdkrw?.change != null && (() => {
                    const chg = mkt.usdkrw.change
                    const up  = chg > 0
                    return (
                      <p className="text-sm font-semibold mb-1" style={{ color: up ? '#ef4444' : '#3b82f6' }}>
                        {up ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}원
                      </p>
                    )
                  })()}
                </div>
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
              <p className="text-[9px] mb-1.5" style={{ color: C.muted }}>원화 환산 주요 통화</p>
              <div className="space-y-1">
                {[
                  { label: '100엔 (JPY)',  krw: data.jpy  ? (data.krw / data.jpy * 100) : null,  warn: data.jpy && (data.krw / data.jpy * 100) < 850 },
                  { label: '1유로 (EUR)',  krw: data.eur  ? (data.krw / data.eur)        : null,  warn: false },
                  { label: '1위안 (CNY)',  krw: data.cny  ? (data.krw / data.cny)        : null,  warn: false },
                ].map(c => (
                  <div key={c.label} className="flex justify-between items-center">
                    <span className="text-[10px]" style={{ color: C.muted }}>{c.label}</span>
                    <span className="text-[11px] font-semibold tabular-nums"
                      style={{ color: c.warn ? C.orange : C.text }}>
                      ₩ {c.krw ? fmtNum(c.krw, 1) : '—'}
                      {c.warn && <span className="ml-1 text-[9px]" style={{ color: C.orange }}>엔저</span>}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] mt-2" style={{ color: C.muted }}>
                기준: {data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR') : '—'}
              </p>
            </div>
          </div>
          {/* 우측: 추세 차트 */}
          <div className="flex-1">
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>
              최근 30일 추이 {krwSeries.length === 0 && <span style={{ color: C.border }}>(04:00 KST 갱신 후 표시)</span>}
            </p>
            {krwSeries.length > 0 ? (
              <div className="h-[185px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={krwSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="krwAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={sc} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={sc} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false}
                      interval={Math.floor(krwSeries.length / 5)} />
                    <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtNum(v, 0)} domain={['auto', 'auto']} />
                    <Tooltip content={({ active, payload, label }) =>
                      active && payload?.length
                        ? <div className="rounded border px-2 py-1 text-xs shadow"
                            style={{ background: C.header, borderColor: C.border }}>
                            <p style={{ color: C.muted }}>{label}</p>
                            <p style={{ color: sc }}><b>₩ {fmtNum(payload[0].value, 1)}</b></p>
                          </div>
                        : null
                    } />
                    <ReferenceLine y={1400} stroke={C.red}    strokeDasharray="3 3"
                      label={{ value: '1,400 위험', fill: C.red,    fontSize: 8, position: 'insideTopRight' }} />
                    <ReferenceLine y={1350} stroke={C.orange} strokeDasharray="3 3"
                      label={{ value: '1,350 주의', fill: C.orange, fontSize: 8, position: 'insideTopRight' }} />
                    <Area type="monotone" dataKey="value" stroke={sc} fill="url(#krwAreaGrad)"
                      strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[185px] flex items-center justify-center rounded"
                style={{ background: C.header, border: `1px dashed ${C.border}` }}>
                <p className="text-[10px]" style={{ color: C.border }}>매일 04:00 KST 갱신</p>
              </div>
            )}
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
  const { data: mkt } = useMarketData()
  const change  = data?.change24h ?? 0
  const isUp    = change >= 0
  const cc      = isUp ? C.green : C.red
  const signal  = change <= -5
    ? { label: '⚠ 위험자산 기피', color: C.red }
    : change >= 5
      ? { label: '위험자산 선호↑', color: C.green }
      : null
  const btcSeries = (mkt?.btc?.series ?? []).slice(-30)

  return (
    <Widget title="비트코인 (위험자산 선호도)" badge={signal?.label} badgeColor={signal?.color}
      helpKey="btc" source="CoinGecko API" sourceUrl="https://www.coingecko.com/en/api"
      source2="Yahoo Finance (추세)" sourceUrl2="https://finance.yahoo.com/quote/BTC-USD/"
      isLive className="col-span-2">
      <InfoBox>
        비트코인은 위험자산 선호도의 선행 지표.
        <span style={{ color: C.red }}> 24h -5%↓</span>는 주식 조정의 전조 신호로 활용합니다.
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="flex gap-5">
          {/* 좌측: 현재값 + 시가총액 + 시그널 + 변동 바 */}
          <div className="w-52 shrink-0 space-y-3">
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
          {/* 우측: 추세 차트 */}
          <div className="flex-1">
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>
              최근 30일 추이 {btcSeries.length === 0 && <span style={{ color: C.border }}>(04:00 KST 갱신 후 표시)</span>}
            </p>
            {btcSeries.length > 0 ? (
              <div className="h-[185px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={btcSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="btcAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={cc} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={cc} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false}
                      interval={Math.floor(btcSeries.length / 5)} />
                    <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false}
                      tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} domain={['auto', 'auto']} />
                    <Tooltip content={({ active, payload, label }) =>
                      active && payload?.length
                        ? <div className="rounded border px-2 py-1 text-xs shadow"
                            style={{ background: C.header, borderColor: C.border }}>
                            <p style={{ color: C.muted }}>{label}</p>
                            <p style={{ color: cc }}><b>${fmtNum(payload[0].value)}</b></p>
                          </div>
                        : null
                    } />
                    <Area type="monotone" dataKey="value" stroke={cc} fill="url(#btcAreaGrad)"
                      strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[185px] flex items-center justify-center rounded"
                style={{ background: C.header, border: `1px dashed ${C.border}` }}>
                <p className="text-[10px]" style={{ color: C.border }}>매일 04:00 KST 갱신</p>
              </div>
            )}
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
  const [tab, setTab] = useState('changes')
  const stocks  = data?.stocks  ?? []
  const changes = data?.changes ?? []

  const TabBtn = ({ id, label, count }) => (
    <button onClick={() => setTab(id)}
      className="flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-t border-b-2 transition-colors"
      style={{
        color:       tab === id ? C.accent : C.muted,
        borderColor: tab === id ? C.accent : 'transparent',
        background:  tab === id ? C.accent + '10' : 'transparent',
      }}>
      {label}
      {count > 0 && (
        <span className="px-1 py-0.5 rounded text-[9px]"
          style={{ background: C.accent + '25', color: C.accent }}>{count}</span>
      )}
    </button>
  )

  return (
    <Widget title="국민연금 포트폴리오" badge="NPS · GitHub Actions" badgeColor={C.accent}
      helpKey="nps" source="금감원 DART OpenAPI (D001)" sourceUrl="https://opendart.fss.or.kr"
      className="col-span-2 row-span-2">
      <InfoBox>
        국민연금은 국내 최대 기관 투자자(약 100조+). 매일 새벽 4시 GitHub Actions가 자동 갱신.
        이들이 장기 보유하는 종목 방향성과 내 포트폴리오를 비교하세요.
      </InfoBox>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <TabBtn id="portfolio" label="📋 누적 포트폴리오" count={stocks.length} />
          <TabBtn id="changes"   label="🔄 최근 변동"       count={changes.length} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: C.muted }}>{data?.updated_at ?? '—'}</span>
          <button onClick={refetch} disabled={loading}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border"
            style={{ color: C.muted, borderColor: C.border }}>
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : error && stocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <AlertTriangle size={28} style={{ color: C.orange }} />
          <p className="text-sm font-medium" style={{ color: C.orange }}>데이터를 가져올 수 없습니다</p>
          <p className="text-[11px] text-center" style={{ color: C.muted }}>
            DART 공시 수집에 실패했습니다.<br />매일 04:00 KST 자동 갱신 시 재시도합니다.
          </p>
          <button onClick={refetch}
            className="mt-1 flex items-center gap-1 text-xs px-3 py-1.5 rounded border"
            style={{ color: C.accent, borderColor: C.accent + '60' }}>
            <RefreshCw size={11} /> 다시 시도
          </button>
        </div>
      ) : tab === 'portfolio' ? (
        /* ── 포트폴리오 탭 ── */
        stocks.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: C.muted }}>
            누적 데이터 없음 — 매일 04:00 KST 공시 수집 후 쌓입니다
          </p>
        ) : (
          <div className="flex gap-4">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: C.border }}>
                    {['순위','종목','비중(%)','변동','공시일'].map(h => (
                      <th key={h} className={`pb-2 font-normal ${h==='공시일'?'text-right hidden sm:table-cell':h==='순위'?'text-left':'text-right'}`}
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
                      <td className="py-2 text-right" style={{ color: C.accent }}>{s.value?.toFixed(2)}%</td>
                      <td className="py-2 text-right"
                        style={{ color: (s.change ?? 0) > 0 ? C.green : (s.change ?? 0) < 0 ? C.red : C.muted }}>
                        {(s.change ?? 0) > 0 ? '+' : ''}{(s.change ?? 0).toFixed(2)}%
                      </td>
                      <td className="py-2 text-right hidden sm:table-cell" style={{ color: C.muted }}>
                        {s.rcept_dt ? s.rcept_dt.slice(5) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="w-36 shrink-0">
              <p className="text-[9px] mb-1" style={{ color: C.muted }}>상위 6종목 비중</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stocks.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: C.muted, fontSize: 8 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: C.text, fontSize: 8 }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length
                        ? <div className="rounded border px-2 py-1 text-xs"
                            style={{ background: C.header, borderColor: C.border }}>
                            <p style={{ color: C.accent }}>{payload[0].value?.toFixed(2)}%</p>
                          </div>
                        : null
                    } />
                    <Bar dataKey="value" fill={C.accent} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ── 변동 탭 ── */
        changes.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-xs" style={{ color: C.muted }}>변동 공시 이력 없음</p>
            <p className="text-[10px]" style={{ color: C.border }}>
              D001은 지분 1% 이상 변동 후 5영업일 이내 보고 의무 — 당일 거래가 즉시 반영되지 않습니다
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <p className="text-[10px] mb-2" style={{ color: C.muted }}>
              국민연금공단 D001 공시 변동 이력 (90일) — 변동 후 최대 5영업일 내 보고
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: C.border }}>
                  {['공시일','종목','이전 비율','이번 비율','변동'].map(h => (
                    <th key={h} className={`pb-2 font-normal ${h==='종목'||h==='공시일'?'text-left':'text-right'}`}
                      style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {changes.map((c, i) => {
                  const isNew = c.is_new
                  const chg   = c.change ?? 0
                  const cc    = isNew ? C.accent : chg > 0 ? C.green : chg < 0 ? C.red : C.muted
                  return (
                    <tr key={i} className="border-b transition-colors"
                      style={{ borderColor: C.border + '50' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.border + '30'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="py-2" style={{ color: C.muted, minWidth: '4.5rem' }}>
                        {c.rcept_dt ?? '—'}
                      </td>
                      <td className="py-2 font-medium" style={{ color: C.text }}>
                        {isNew && <span className="mr-1 text-[9px] px-1 rounded" style={{ background: C.accent + '25', color: C.accent }}>신규</span>}
                        {c.name}
                      </td>
                      <td className="py-2 text-right" style={{ color: C.muted }}>
                        {c.prev != null ? `${c.prev.toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-2 text-right font-semibold" style={{ color: C.accent }}>{c.value?.toFixed(2)}%</td>
                      <td className="py-2 text-right font-semibold" style={{ color: cc }}>
                        {isNew ? '신규' : `${chg > 0 ? '+' : ''}${chg.toFixed(2)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      {/* Last Updated */}
      {data?.updated_at && (
        <p className="text-[9px] mt-3 text-right" style={{ color: C.border }}>
          🕐 Last Updated: {data.updated_at}
        </p>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ⑥: 금리 / 매크로 (GitHub Actions — yfinance)
// ═══════════════════════════════════════════════════
function FedWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useMarketData()
  const tnx   = data?.treasury_10y
  const us3m  = data?.treasury_2y    // key name in json: treasury_2y (실제론 3개월물 ^IRX)
  const kr10y = data?.kr_10y
  const kr3y  = data?.kr_3y
  const dxy   = data?.dxy

  const rateUp = (tnx?.change ?? 0) > 0
  const dxyUp  = (dxy?.change ?? 0) > 0
  const danger = rateUp && dxyUp

  // 한미 10Y 금리 스프레드 (KR - US)
  const spread = (kr10y?.latest != null && tnx?.latest != null)
    ? (kr10y.latest - tnx.latest).toFixed(2)
    : null

  // 차트: 미국·한국 10Y 금리를 날짜로 병합
  const rateChart = (() => {
    const tnxMap  = {}; (tnx?.series   ?? []).forEach(d => { tnxMap[d.date]  = d.value })
    const krMap   = {}; (kr10y?.series ?? []).forEach(d => { krMap[d.date]   = d.value })
    const kr3Map  = {}; (kr3y?.series  ?? []).forEach(d => { kr3Map[d.date]  = d.value })
    const us3Map  = {}; (us3m?.series  ?? []).forEach(d => { us3Map[d.date]  = d.value })
    const dates = [...new Set([
      ...(tnx?.series ?? []).map(d => d.date),
      ...(kr10y?.series ?? []).map(d => d.date),
    ])].sort()
    return dates.map(date => ({
      date,
      us10y: tnxMap[date]  ?? null,
      us3m:  us3Map[date]  ?? null,
      kr10y: krMap[date]   ?? null,
      kr3y:  kr3Map[date]  ?? null,
    })).filter(d => d.us10y !== null || d.kr10y !== null).slice(-30)
  })()

  const rates = [
    { label: '미 국채 10Y',  key: 'us10y', value: tnx?.latest,   abs: tnx?.change,   color: C.accent,  flag: '🇺🇸' },
    { label: '미 국채 3M',   key: 'us3m',  value: us3m?.latest,  abs: us3m?.change,  color: C.purple,  flag: '🇺🇸' },
    { label: '한국 국채 10Y',key: 'kr10y', value: kr10y?.latest, abs: kr10y?.change, color: C.orange,  flag: '🇰🇷' },
    { label: '한국 국채 3Y', key: 'kr3y',  value: kr3y?.latest,  abs: kr3y?.change,  color: C.yellow,  flag: '🇰🇷' },
  ]

  return (
    <Widget title="금리 · 매크로"
      badge={danger ? '⚠ 위험자산 주의' : '안정'} badgeColor={danger ? C.red : C.green}
      helpKey="fed" source="Yahoo Finance (yfinance)" sourceUrl="https://finance.yahoo.com"
      source2="한국은행 ECOS" sourceUrl2="https://ecos.bok.or.kr" className="col-span-2">
      <InfoBox>
        미·한국 금리와 달러 인덱스(DXY).
        <span style={{ color: C.red }}> 미국 금리·달러 동반 상승</span> = 주식에서 채권·달러로 돈 이동.
        미국 금리: Yahoo Finance (yfinance) · 한국 금리:{' '}
        <a href="https://ecos.bok.or.kr" target="_blank" rel="noopener noreferrer"
          style={{ color: C.accent }}>한국은행 ECOS</a>.
        매일 새벽 04:00 KST 자동 갱신.
        {data?.updated_at && <span style={{ color: C.muted }}> · 갱신: {data.updated_at}</span>}
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <>
          {/* 금리 4개 수치 그리드 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {rates.map(r => {
              const up = (r.abs ?? 0) > 0
              // 금리는 상승=적색(채권값↓, 주식에 악재), 하락=청색
              const arrowColor = up ? '#ef4444' : '#3b82f6'
              return (
                <div key={r.key} className="rounded p-2" style={{ background: C.header, border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] mb-0.5" style={{ color: C.muted }}>{r.flag} {r.label}</p>
                  <div className="flex items-end gap-1.5 flex-wrap">
                    <p className="text-lg font-bold" style={{ color: r.value != null ? r.color : C.muted }}>
                      {r.value != null ? `${r.value.toFixed(2)}%` : '—'}
                    </p>
                    {r.abs != null && (
                      <p className="text-[10px] mb-0.5 font-semibold" style={{ color: arrowColor }}>
                        {up ? '▲' : '▼'} {Math.abs(r.abs).toFixed(3)}%p
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 스프레드 & DXY */}
          <div className="flex gap-2 mb-3">
            {spread !== null && (
              <div className="flex-1 rounded px-3 py-1.5 text-[10px]"
                style={{ background: C.border + '50', border: `1px solid ${C.border}` }}>
                <span style={{ color: C.muted }}>한미 금리차 (KR10Y − US10Y) </span>
                <span className="font-semibold" style={{ color: parseFloat(spread) >= 0 ? C.green : C.red }}>
                  {parseFloat(spread) >= 0 ? '+' : ''}{spread}%p
                </span>
              </div>
            )}
            <div className="flex-1 rounded px-3 py-1.5 text-[10px]"
              style={{ background: C.border + '50', border: `1px solid ${C.border}` }}>
              <span style={{ color: C.muted }}>DXY </span>
              <span className="font-semibold" style={{ color: dxyUp ? '#ef4444' : '#3b82f6' }}>
                {dxy?.latest?.toFixed(2) ?? '—'}
                {dxy?.change != null && (
                  <span> {dxyUp ? '▲' : '▼'} {Math.abs(dxy.change).toFixed(2)}</span>
                )}
                <span style={{ color: C.muted }}> {dxyUp ? '(강달러)' : '(약달러)'}</span>
              </span>
            </div>
          </div>

          {danger && (
            <div className="mb-2 flex items-center gap-1.5 rounded border px-2 py-1.5 text-[10px]"
              style={{ color: C.red, borderColor: C.red + '40', background: C.red + '10' }}>
              <AlertTriangle size={10} />
              금리·달러 동반 상승 — 주식 비중 보수적 조절 고려
            </div>
          )}

          {/* 차트: 한미 10Y 금리 추이 */}
          <div>
            <p className="text-[9px] mb-1" style={{ color: C.muted }}>한·미 국채 금리 추이 (30일)</p>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Line type="monotone" dataKey="us10y" name="미국10Y(%)" stroke={C.accent}  strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="kr10y" name="한국10Y(%)" stroke={C.orange}  strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="kr3y"  name="한국3Y(%)"  stroke={C.yellow}  strokeWidth={1}   dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="us3m"  name="미국3M(%)"  stroke={C.purple}  strokeWidth={1}   dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-1">
              {[
                { color: C.accent, label: '🇺🇸 미국 10Y', dash: false },
                { color: C.purple, label: '🇺🇸 미국 3M',  dash: true  },
                { color: C.orange, label: '🇰🇷 한국 10Y', dash: false },
                { color: C.yellow, label: '🇰🇷 한국 3Y',  dash: true  },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1 text-[9px]" style={{ color: C.muted }}>
                  <svg width="18" height="8">
                    <line x1="0" y1="4" x2="18" y2="4" stroke={l.color} strokeWidth="2"
                      strokeDasharray={l.dash ? '4 3' : 'none'} />
                  </svg>
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯: 주요 지수 (GitHub Actions — yfinance)
// ═══════════════════════════════════════════════════
function IndexMini({ label, flag, data: d, color }) {
  const C  = useC()
  const up = (d?.change_pct ?? 0) >= 0
  const c  = up ? C.green : C.red
  const series = (d?.series ?? []).slice(-30)

  return (
    <div className="rounded p-2.5" style={{ background: C.header, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold" style={{ color: C.muted }}>{flag} {label}</span>
        <span className="text-[9px] font-semibold px-1 rounded"
          style={{ color: c, background: c + '18' }}>
          {up ? '▲' : '▼'} {Math.abs(d?.change_pct ?? 0).toFixed(2)}%
        </span>
      </div>
      <p className="text-base font-bold tabular-nums mb-1.5" style={{ color: C.text }}>
        {d?.latest != null ? fmtNum(d.latest, 2) : '—'}
      </p>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`idx-grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={c} stopOpacity={0.3} />
                <stop offset="95%" stopColor={c} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              content={({ active, payload }) => active && payload?.[0] ? (
                <div className="rounded px-2 py-1 text-[10px]"
                  style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                  {payload[0].payload.date}: {fmtNum(payload[0].value, 2)}
                </div>
              ) : null}
            />
            <Area type="monotone" dataKey="value" stroke={c} strokeWidth={1.5}
              fill={`url(#idx-grad-${label})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function IndicesWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useMarketData()

  const indices = [
    { key: 'kospi',  label: 'KOSPI',   flag: '🇰🇷' },
    { key: 'kosdaq', label: 'KOSDAQ',  flag: '🇰🇷' },
    { key: 'spx',    label: 'S&P 500', flag: '🇺🇸' },
    { key: 'nasdaq', label: 'NASDAQ',  flag: '🇺🇸' },
  ]

  return (
    <Widget title="주요 지수" helpKey="indices"
      source="Yahoo Finance (yfinance)" sourceUrl="https://finance.yahoo.com"
      className="col-span-4">
      <InfoBox>
        KOSPI·KOSDAQ·S&P500·NASDAQ 3개월 추이.
        <span style={{ color: C.muted }}> 매일 04:00 KST 자동갱신.</span>
        {data?.updated_at && <span style={{ color: C.muted }}> · 갱신: {data.updated_at}</span>}
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {indices.map(idx => (
            <IndexMini key={idx.key} label={idx.label} flag={idx.flag} data={data?.[idx.key]} />
          ))}
        </div>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯: 금 (GitHub Actions — yfinance)
// ═══════════════════════════════════════════════════
function GoldWidget() {
  const C = useC()
  const { data, loading, error, refetch } = useMarketData()
  const gold   = data?.gold
  const latest = gold?.latest
  const prev   = gold?.prev
  const pct    = gold?.change_pct ?? 0
  const up     = pct >= 0
  const c      = up ? C.green : C.red

  return (
    <Widget title="금 선물 (Gold)" badge={up ? '▲ 상승' : '▼ 하락'} badgeColor={c}
      helpKey="gold" source="Yahoo Finance (GC=F)" sourceUrl="https://finance.yahoo.com/quote/GC=F/">
      <InfoBox>
        안전자산 선호도 지표. 금리 하락·달러 약세 구간에서 강세.
        <span style={{ color: C.red }}> 급등 = 시장 불확실성 신호.</span>
        {data?.updated_at && <span style={{ color: C.muted }}> · {data.updated_at}</span>}
      </InfoBox>
      {loading ? <Spinner /> : error ? <ApiError msg={error} onRetry={refetch} /> : (
        <>
          <div className="flex items-end gap-2 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>USD / troy oz</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c }}>
                ${latest != null ? fmtNum(latest, 0) : '—'}
              </p>
            </div>
            <p className="text-xs mb-1 font-semibold" style={{ color: c }}>
              {up ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
            </p>
          </div>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(gold?.series ?? []).slice(-60)} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.yellow} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.yellow} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip unit=" USD" />} />
                <Area type="monotone" dataKey="value" name="금 선물" stroke={C.yellow}
                  fill="url(#goldGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Widget>
  )
}

// ═══════════════════════════════════════════════════
// 위젯 ⑦: 시장 건강 상태 (GitHub Actions — yfinance KOSPI 80종목)
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
      helpKey="breadth" source="Yahoo Finance (yfinance)" sourceUrl="https://finance.yahoo.com"
      source2="KOSPI 주요주 80종목" sourceUrl2="https://finance.yahoo.com/quote/%5EKS11/"
      className="col-span-2">
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
// 한국장 공포탐욕지수 (자체 복합 산출)
// ═══════════════════════════════════════════════════
function computeKrFng(mkt, breadth) {
  // 1. KOSPI 모멘텀: MA20 이격도 → 0-100
  const kospiSeries = mkt?.kospi?.series ?? []
  let kospiScore = 50
  if (kospiSeries.length >= 5) {
    const slice = kospiSeries.slice(-20)
    const ma    = slice.reduce((s, d) => s + d.value, 0) / slice.length
    const cur   = kospiSeries[kospiSeries.length - 1]?.value
    if (ma && cur) {
      const dev = (cur / ma - 1) * 100   // % 이격
      kospiScore = Math.max(0, Math.min(100, (dev + 5) / 10 * 100))
    }
  }

  // 2. KOSDAQ 상대강도: KOSDAQ 변동률 − KOSPI 변동률 → 0-100
  const kospiPct  = mkt?.kospi?.change_pct  ?? 0
  const kosdaqPct = mkt?.kosdaq?.change_pct ?? 0
  const kosdaqScore = Math.max(0, Math.min(100, (kosdaqPct - kospiPct + 3) / 6 * 100))

  // 3. 신고가 비율: breadth.latest.ratio (이미 0-100)
  const breadthScore = breadth?.latest?.ratio ?? 50

  // 4. VIX 역수: VIX 10 → 100점, VIX 45 → 0점
  const vix = mkt?.vix?.latest
  const vixScore = vix != null ? Math.max(0, Math.min(100, (45 - vix) / 35 * 100)) : 50

  // 5. 수익률 곡선: KR10Y - KR3Y (장단기 스프레드)
  const kr10y = mkt?.kr_10y?.latest
  const kr3y  = mkt?.kr_3y?.latest
  let curveScore = 50
  if (kr10y != null && kr3y != null) {
    curveScore = Math.max(0, Math.min(100, (kr10y - kr3y + 0.5) / 2 * 100))
  }

  const components = [
    { label: 'KOSPI 모멘텀',    icon: '📈', score: Math.round(kospiScore),   weight: 0.25 },
    { label: 'KOSDAQ 상대강도', icon: '⚡', score: Math.round(kosdaqScore),  weight: 0.20 },
    { label: '신고가 비율',      icon: '🏔️', score: Math.round(breadthScore), weight: 0.25 },
    { label: 'VIX 역수',        icon: '😰', score: Math.round(vixScore),     weight: 0.20 },
    { label: '수익률 곡선',      icon: '📐', score: Math.round(curveScore),   weight: 0.10 },
  ]
  const total = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0))
  return { score: total, components }
}

/** 일별 한국장 공포탐욕 시계열 (market.json 시계열 데이터로 자체 계산) */
function computeKrFngSeries(mkt, breadth) {
  const kospiArr  = mkt?.kospi?.series  ?? []
  const kosdaqArr = mkt?.kosdaq?.series ?? []
  const vixArr    = mkt?.vix?.series    ?? []
  const kr10yArr  = mkt?.kr_10y?.series ?? []
  const kr3yArr   = mkt?.kr_3y?.series  ?? []
  const breadthRatio = breadth?.latest?.ratio ?? 50

  if (kospiArr.length < 5) return []

  const kosdaqChgByDate = {}
  for (let i = 1; i < kosdaqArr.length; i++) {
    const pv = kosdaqArr[i - 1].value
    const cv = kosdaqArr[i].value
    if (pv) kosdaqChgByDate[kosdaqArr[i].date] = (cv / pv - 1) * 100
  }
  const vixByDate   = Object.fromEntries(vixArr.map(d   => [d.date, d.value]))
  const kr10yByDate = Object.fromEntries(kr10yArr.map(d => [d.date, d.value]))
  const kr3yByDate  = Object.fromEntries(kr3yArr.map(d  => [d.date, d.value]))

  const result = []
  for (let i = 1; i < kospiArr.length; i++) {
    const date  = kospiArr[i].date
    const cur   = kospiArr[i].value
    const prev  = kospiArr[i - 1].value

    // 1. KOSPI 모멘텀 (MA 이격도)
    const slice = kospiArr.slice(Math.max(0, i - 19), i + 1)
    const ma    = slice.reduce((s, d) => s + d.value, 0) / slice.length
    const dev   = (cur / ma - 1) * 100
    const kospiScore = Math.max(0, Math.min(100, (dev + 5) / 10 * 100))

    // 2. KOSDAQ 상대강도 (당일 전일비 vs KOSPI 전일비)
    const kp  = prev ? (cur / prev - 1) * 100 : 0
    const kdp = kosdaqChgByDate[date] ?? 0
    const kosdaqScore = Math.max(0, Math.min(100, (kdp - kp + 3) / 6 * 100))

    // 3. VIX 역수
    const vix = vixByDate[date]
    const vixScore = vix != null ? Math.max(0, Math.min(100, (45 - vix) / 35 * 100)) : 50

    // 4. 수익률 곡선 (KR10Y − KR3Y)
    const kr10y = kr10yByDate[date]
    const kr3y  = kr3yByDate[date]
    let curveScore = 50
    if (kr10y != null && kr3y != null) {
      curveScore = Math.max(0, Math.min(100, (kr10y - kr3y + 0.5) / 2 * 100))
    }

    const total = Math.round(
      kospiScore * 0.25 + kosdaqScore * 0.20 + breadthRatio * 0.25 + vixScore * 0.20 + curveScore * 0.10
    )
    result.push({ date, value: total })
  }
  return result.slice(-30)
}

function KrFngWidget() {
  const C = useC()
  const { data: mkt,     loading: ml, error: me, refetch: mr } = useMarketData()
  const { data: breadth, loading: bl, error: be, refetch: br } = useBreadthData()

  const loading = ml || bl
  const error   = me || be
  const result  = (!loading && !error && mkt) ? computeKrFng(mkt, breadth) : null
  const val     = result?.score ?? null
  const status  = val !== null ? getFngStatus(C, val) : null
  const gc      = status?.color ?? C.muted
  const krFngSeries = (!loading && !error && mkt) ? computeKrFngSeries(mkt, breadth) : []

  return (
    <Widget title="한국장 공포탐욕지수 (복합 산출)" badge={status?.label} badgeColor={status?.color}
      helpKey="krfng" source="Yahoo Finance (yfinance)" sourceUrl="https://finance.yahoo.com"
      source2="한국은행 ECOS" sourceUrl2="https://ecos.bok.or.kr" className="col-span-2">
      <InfoBox>
        <span style={{ color: C.accent }}>한국 주식시장 전용</span> 복합 심리 지수 (자체 산출 · 참고용).
        KOSPI 이격도·KOSDAQ 상대강도·신고가비율·VIX 역수·수익률 곡선 5가지를 가중합산.{' '}
        <span style={{ color: C.red }}>25 이하 = 분할 매수 탐색</span>,{' '}
        <span style={{ color: C.green }}>75 이상 = 차익실현 신호</span>.
      </InfoBox>
      {loading ? <Spinner /> : error ? (
        <ApiError msg={error} onRetry={() => { mr(); br() }} />
      ) : (
        <div className="flex gap-5">
          {/* 좌측: 수치 + 게이지 + 범례 */}
          <div className="w-36 shrink-0 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>한국장 지수</p>
              <p className="text-4xl font-bold" style={{ color: gc }}>{val ?? '—'}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: gc }}>{status?.label}</p>
              <span className="inline-block text-[10px] mt-1 px-2 py-0.5 rounded"
                style={{ background: gc + '18', color: gc, border: `1px solid ${gc}30` }}>
                → {status?.action}
              </span>
            </div>
            {/* 반원 게이지 */}
            {val !== null && <GaugeMeter value={val} uid="krfng" />}
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

          {/* 우측: 5개 구성 지표 바 + 산식 설명 */}
          <div className="flex-1 flex flex-col gap-3">
            <div>
              <p className="text-[10px] mb-2" style={{ color: C.muted }}>5개 구성 지표</p>
              <div className="space-y-2">
                {result?.components?.map(comp => {
                  const cs = getFngStatus(C, comp.score)
                  return (
                    <div key={comp.label}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px]" style={{ color: C.muted }}>
                          {comp.icon} {comp.label}
                          <span className="ml-1" style={{ color: C.border }}>
                            ({Math.round(comp.weight * 100)}%)
                          </span>
                        </span>
                        <span className="text-[10px] font-semibold tabular-nums" style={{ color: cs.color }}>
                          {comp.score}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${comp.score}%`, background: cs.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 추세 차트 */}
            {krFngSeries.length > 0 && (
              <div>
                <p className="text-[10px] mb-1" style={{ color: C.muted }}>최근 30일 추이</p>
                <div className="h-[110px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={krFngSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="krFngAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={gc} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={gc} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 8 }} tickLine={false} axisLine={false}
                        interval={Math.floor(krFngSeries.length / 5)} />
                      <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 8 }} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label }) =>
                        active && payload?.length
                          ? <div className="rounded border px-2 py-1 text-xs shadow"
                              style={{ background: C.header, borderColor: C.border }}>
                              <p style={{ color: C.muted }}>{label}</p>
                              <p style={{ color: getFngStatus(C, payload[0].value).color }}>
                                <b>{payload[0].value}</b> — {getFngStatus(C, payload[0].value).label}
                              </p>
                            </div>
                          : null
                      } />
                      <ReferenceLine y={25} stroke={C.red}   strokeDasharray="3 3" />
                      <ReferenceLine y={75} stroke={C.green} strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="value" stroke={gc} fill="url(#krFngAreaGrad)"
                        strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[9px] mt-1" style={{ color: C.border }}>
                  ※ KOSPI 이격도(25%)·KOSDAQ 강도(20%)·신고가(25%)·VIX역수(20%)·수익률곡선(10%) · 참고 전용
                </p>
              </div>
            )}
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
  const [journalLog, setJournalLog] = useState(() => {
    try {
      const s = localStorage.getItem('hemstock_journal_log')
      if (s) return JSON.parse(s)
      // 구 버전 텍스트 메모 마이그레이션
      const old = localStorage.getItem('hemstock_journal')
      if (old?.trim()) return [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), text: old.trim() }]
      return []
    } catch { return [] }
  })
  const [journalInput, setJournalInput] = useState('')
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
  const addJournalEntry = () => {
    if (!journalInput.trim()) return
    const entry = { id: Date.now(), date: new Date().toISOString().slice(0, 10), text: journalInput.trim() }
    const next  = [entry, ...journalLog]
    setJournalLog(next)
    localStorage.setItem('hemstock_journal_log', JSON.stringify(next))
    setJournalInput('')
  }
  const removeJournalEntry = (id) => {
    const next = journalLog.filter(e => e.id !== id)
    setJournalLog(next)
    localStorage.setItem('hemstock_journal_log', JSON.stringify(next))
  }
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

        {/* 트레이딩 저널 (누적 로그) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>트레이딩 저널</p>
            {journalLog.length > 0 && (
              <span className="text-[9px]" style={{ color: C.border }}>{journalLog.length}건</span>
            )}
          </div>
          {/* 입력 영역 */}
          <textarea
            value={journalInput}
            onChange={e => setJournalInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addJournalEntry() }}
            placeholder="오늘의 판단 근거, 반성, 배운 점..."
            rows={3}
            className="w-full rounded px-3 py-2 text-[11px] leading-relaxed outline-none resize-none placeholder:text-[#9ca3af]"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          <button onClick={addJournalEntry}
            className="w-full mt-1 py-1.5 rounded text-[11px] font-semibold transition-all"
            style={{ background: C.accent + '20', color: C.accent, border: `1px solid ${C.accent}40` }}
            onMouseEnter={e => { e.currentTarget.style.background = C.accent + '35' }}
            onMouseLeave={e => { e.currentTarget.style.background = C.accent + '20' }}>
            기록하기 ↵ (Ctrl+Enter)
          </button>
          {/* 로그 목록 */}
          {journalLog.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {journalLog.map(entry => (
                <div key={entry.id} className="group rounded px-2.5 py-1.5 text-[10px] leading-snug"
                  style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="flex items-start justify-between gap-1">
                    <span className="shrink-0 font-semibold" style={{ color: C.accent }}>[{entry.date}]</span>
                    <button onClick={() => removeJournalEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                      style={{ color: C.muted }}>
                      <X size={9} />
                    </button>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap" style={{ color: C.text }}>{entry.text}</p>
                </div>
              ))}
            </div>
          )}
          {journalLog.length === 0 && (
            <p className="text-[9px] mt-2 text-center" style={{ color: C.border }}>
              기록하기 버튼으로 로그를 누적할 수 있어요
            </p>
          )}
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
  const { data: mkt } = useMarketData()
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (v, decimals = 2) =>
    v != null ? v.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '로딩...'
  const sign = (v) => v != null ? (v >= 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`) : ''

  const indices = [
    { name: 'KOSPI',   value: fmt(mkt?.kospi?.latest,  2), change: sign(mkt?.kospi?.change_pct),  up: (mkt?.kospi?.change_pct  ?? 0) >= 0 },
    { name: 'KOSDAQ',  value: fmt(mkt?.kosdaq?.latest, 2), change: sign(mkt?.kosdaq?.change_pct), up: (mkt?.kosdaq?.change_pct ?? 0) >= 0 },
    { name: 'S&P500',  value: fmt(mkt?.spx?.latest,    2), change: sign(mkt?.spx?.change_pct),    up: (mkt?.spx?.change_pct    ?? 0) >= 0 },
    { name: 'NASDAQ',  value: fmt(mkt?.nasdaq?.latest,  2), change: sign(mkt?.nasdaq?.change_pct), up: (mkt?.nasdaq?.change_pct ?? 0) >= 0 },
    {
      name: 'US10Y',
      value: mkt?.treasury_10y?.latest != null ? `${mkt.treasury_10y.latest.toFixed(2)}%` : '로딩...',
      change: sign(mkt?.treasury_10y?.change_pct),
      up: (mkt?.treasury_10y?.change_pct ?? 0) >= 0,
    },
    {
      name: 'KR10Y',
      value: mkt?.kr_10y?.latest != null ? `${mkt.kr_10y.latest.toFixed(2)}%` : '—',
      change: sign(mkt?.kr_10y?.change_pct),
      up: (mkt?.kr_10y?.change_pct ?? 0) >= 0,
    },
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
// 섹션 헤더
// ═══════════════════════════════════════════════════
function SectionHeader({ flag, title, sub }) {
  const C = useC()
  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center gap-3 pt-2 pb-1">
      <span className="text-lg leading-none">{flag}</span>
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.text }}>{title}</p>
        <p className="text-[10px]" style={{ color: C.muted }}>{sub}</p>
      </div>
      <div className="flex-1 h-px ml-2" style={{ background: C.border }} />
    </div>
  )
}

// ═══════════════════════════════════════════════════
// 메인 대시보드
// ═══════════════════════════════════════════════════
export default function Dashboard() {
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

  // 모바일 사이드바 토글
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ThemeCtx.Provider value={C}>
      <div className="flex h-screen overflow-hidden"
        style={{ background: C.bg, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>

        {/* 사이드바 — 데스크톱: 고정, 모바일: 오버레이 */}
        {/* 모바일 오버레이 배경 */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)} />
        )}
        <div className={`
          fixed lg:relative z-40 lg:z-auto h-full
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* 메인 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar isDark={isDark} toggleTheme={toggleTheme} onMenuClick={() => setSidebarOpen(v => !v)} />

          <main className="flex-1 overflow-y-auto p-3 lg:p-4">
            {/* ── 반응형 그리드: 모바일 1열 → 태블릿 2열 → 데스크톱 4열 ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 auto-rows-min">

              {/* ── 섹션 1: 글로벌 심리 지표 (실시간) ── */}
              <SectionHeader flag="🌐" title="글로벌 심리 지표"
                sub="실시간 · 브라우저 직접 fetch · API 키 불필요" />

              {/* 주식 공포탐욕: 데스크톱 2칸 */}
              <div className="col-span-1 sm:col-span-2">
                <CnnFngWidget />
              </div>
              {/* 코인 공포탐욕: 데스크톱 2칸 */}
              <div className="col-span-1 sm:col-span-2">
                <FearAndGreedWidget />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <UsdKrwWidget />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <BitcoinWidget />
              </div>
              <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                <GoldWidget />
              </div>

              {/* ── 섹션 2: 주요 지수 (GitHub Actions) ── */}
              <SectionHeader flag="📈" title="주요 지수"
                sub="매일 04:00 KST 자동갱신 · Yahoo Finance (yfinance)" />

              {/* 지수 4개: 전체 너비 */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                <IndicesWidget />
              </div>

              {/* ── 섹션 3: 미국 시장 (GitHub Actions · yfinance) ── */}
              <SectionHeader flag="🇺🇸" title="미국 시장 / 매크로"
                sub="매일 04:00 KST 자동갱신 · Yahoo Finance (yfinance)" />

              {/* 금리·매크로: 전체 너비 */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                <FedWidget />
              </div>

              {/* ── 섹션 4: 한국 시장 (GitHub Actions) ── */}
              <SectionHeader flag="🇰🇷" title="한국 시장"
                sub="매일 04:00 KST 자동갱신 · DART OpenAPI · yfinance" />

              {/* NPS: 데스크톱 2칸 × 2행, 모바일 전체 */}
              <div className="col-span-1 sm:col-span-2 lg:row-span-2">
                <NpsWidget className="h-full" />
              </div>

              {/* 신고가: 데스크톱 2칸 */}
              <div className="col-span-1 sm:col-span-2">
                <BreadthWidget />
              </div>

              {/* 한국장 공포탐욕: 데스크톱 2칸 (NPS 2행 아래 빈 칸에 위치) */}
              <div className="col-span-1 sm:col-span-2">
                <KrFngWidget />
              </div>

              {/* 푸터 */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 px-1 py-3 text-[10px]"
                style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
                <span className="leading-relaxed">
                  HemStock v0.6 ·
                  <span style={{ color: C.green }}> ✓ 실시간</span>: 공포탐욕·환율·BTC ·
                  <span style={{ color: C.accent }}> ⟳ 04:00 KST</span>: 지수·금·VIX·금리·DXY·NPS·신고가
                </span>
                <span className="shrink-0">투자 참고용 · 투자 권유 아님</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ThemeCtx.Provider>
  )
}
