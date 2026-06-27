"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI + 공시 뷰어
전략:
  1) corpCode.xml → 대상 종목 corp_code 매핑 (exact match)
  2) list.json (D001: 주식대량보유상황보고) → 국민연금 공시 발견
  3) dart.fss.or.kr 뷰어 HTML 스크래핑 → 보유비율 추출
     (document.json API는 D001 타입에서 101 오류 발생하여 우회)
  4) 실패 시 빈 목록 반환 (fallback 목 데이터 사용 안 함)

환경변수: DART_API_KEY (GitHub Secret)
결과: public/data/nps.json
"""

import io
import json
import os
import re
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "nps.json"
KST  = timezone(timedelta(hours=9))
KEY  = os.environ.get("DART_API_KEY", "").strip()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Referer": "https://dart.fss.or.kr/",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

DART_CORPS = {
    "삼성전자":           "00126380",
    "삼성SDI":            "00126362",
    "삼성전기":           "00126371",
    "삼성물산":           "00126229",
    "삼성바이오로직스":   "00877059",
    "삼성생명":           "00126256",
    "기아":               "00106641",
    "현대자동차":         "00164742",
    "현대모비스":         "00164760",
    "현대제철":           "00145880",
    "현대글로비스":       "00360595",
    "POSCO홀딩스":        "00155319",
    "KB금융":             "00688996",
    "신한지주":           "00382199",
    "하나금융지주":       "00547583",
    "우리금융지주":       "00375302",
    "한화에어로스페이스": "00126566",
    "두산에너빌리티":     "00159616",
    "한국전력공사":       "00159193",
    "고려아연":           "00102858",
    "크래프톤":           "00760971",
    "NAVER":              "00266961",
    "HD한국조선해양":     "00164830",
    "HD현대중공업":       "01390344",
}

EXTRA_NAMES = [
    "SK하이닉스", "LG에너지솔루션", "LG화학", "LG전자", "LG",
    "카카오", "KT", "SK텔레콤", "SK이노베이션", "셀트리온",
    "카카오뱅크", "SK",
]


# ── Step 1: corpCode.xml에서 추가 종목 매핑 ─────────────────────
def enrich_corp_codes(base: dict) -> dict:
    print("  corpCode.xml 다운로드 중...")
    url = "https://opendart.fss.or.kr/api/corpCode.xml"
    res = SESSION.get(url, params={"crtfc_key": KEY}, timeout=60)
    res.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        fname = [n for n in z.namelist() if "CORPCODE" in n.upper()][0]
        with z.open(fname) as f:
            tree = ET.parse(f)

    result = dict(base)
    for item in tree.getroot().findall("list"):
        code       = (item.findtext("corp_code") or "").strip()
        name       = (item.findtext("corp_name") or "").strip()
        stock_code = (item.findtext("stock_code") or "").strip()
        if code and name and stock_code and name in EXTRA_NAMES and name not in result:
            result[name] = code
            print(f"    추가 매핑: {name} → {code}")

    print(f"  총 매핑: {len(result)}종목")
    return result


# ── Step 2: 종목별 국민연금 D001 공시 목록 ───────────────────────
def get_nps_filings(corp_code: str) -> list[dict]:
    now    = datetime.now(KST)
    end_de = now.strftime("%Y%m%d")
    bgn_de = (now - timedelta(days=365)).strftime("%Y%m%d")

    params = {
        "crtfc_key":        KEY,
        "corp_code":        corp_code,
        "pblntf_detail_ty": "D001",
        "bgn_de":           bgn_de,
        "end_de":           end_de,
        "page_no":          "1",
        "page_count":       "20",
    }
    res  = SESSION.get("https://opendart.fss.or.kr/api/list.json", params=params, timeout=10)
    data = res.json()
    if data.get("status") not in ("000", "013"):
        return []
    items = data.get("list", [])
    nps   = [i for i in items if "국민연금" in i.get("flr_nm", "")]
    return sorted(nps, key=lambda x: x.get("rcept_dt", ""), reverse=True)


# ── Step 3: DART 뷰어 HTML → 보유비율 추출 ──────────────────────
def extract_ratio(text: str):
    """HTML 테이블에서 보유비율 추출 — BeautifulSoup 우선, 날짜 오탐 방지"""
    soup = BeautifulSoup(text, "html.parser")

    # ① 테이블 셀에서 "보유비율" 또는 "지분율" 텍스트를 찾고 인접 셀 값 파싱
    keywords = ("보유비율", "보유 비율", "지분율", "보유주식비율")
    for cell in soup.find_all(["td", "th"]):
        cell_txt = cell.get_text(strip=True).replace(" ", "")
        if any(kw.replace(" ", "") in cell_txt for kw in keywords):
            # 다음 td 또는 다음다음 td에서 숫자 추출
            for sibling in [cell.find_next_sibling("td"),
                            cell.find_next("td")]:
                if sibling is None:
                    continue
                raw = sibling.get_text(strip=True).replace(",", "").replace("%", "").replace("％", "").strip()
                try:
                    v = float(raw)
                    if 5.0 <= v <= 25.0:
                        return v
                except ValueError:
                    # 숫자만 추출
                    m = re.search(r"([0-9]+\.[0-9]{1,4})", raw)
                    if m:
                        v = float(m.group(1))
                        if 5.0 <= v <= 25.0:
                            return v

    # ② XML 태그 형태 (XBRL)
    for tag in ("holdRto", "bndtRto", "posesnStockRto"):
        m = re.search(rf"<{tag}[^>]*>\s*([0-9]+\.[0-9]+)\s*</{tag}>", text, re.I)
        if m:
            v = float(m.group(1))
            if 5.0 <= v <= 25.0:
                return v

    # ③ "보유비율" 뒤에 바로 % 붙은 패턴 — 날짜 오탐 방지 위해 % 필수
    m = re.search(r"보유\s*비율[^0-9<]{0,60}([0-9]+\.[0-9]{1,4})\s*(?:%|％)", text)
    if m:
        v = float(m.group(1))
        if 5.0 <= v <= 25.0:
            return v

    return None  # 날짜 오탐 방지: catch-all 패턴 제거


def parse_viewer_params(html: str, corp_name: str = ""):
    """dsaf001/main.do HTML의 JS에서 '보유비율' 섹션 viewer 파라미터 추출"""
    # JS 구조: nodeX['text'] = "... 보유비율 ..."; nodeX['dcmNo'] = "..."; ...
    # 단계 1: '보유비율' 텍스트가 있는 노드 변수명과 위치 찾기
    text_m = re.search(
        r"(node\w+)\[.text.\]\s*=\s*[\"'][^\"']*보유비율[^\"']*[\"']",
        html
    )
    if not text_m:
        if corp_name == "KB금융":
            print(f"  [DEBUG KB금융] JS에서 '보유비율' node 못 찾음")
            idx = html.find("보유비율")
            if idx >= 0:
                print(f"    '보유비율' 위치={idx}, 주변: {repr(html[max(0,idx-30):idx+80])}")
        return None

    var_name  = text_m.group(1)
    start_pos = text_m.start()
    # 해당 노드 블록 (최대 800자) 추출
    section   = html[start_pos : start_pos + 800]

    if corp_name == "KB금융":
        print(f"  [DEBUG KB금융] 노드변수={var_name}, 섹션: {repr(section[:300])}")

    # 단계 2: 각 파라미터를 개별 추출
    params = {}
    for key in ("dcmNo", "eleId", "offset", "length", "dtd"):
        m = re.search(
            rf"{re.escape(var_name)}\[.{key}.\]\s*=\s*[\"']([^\"']+)[\"']",
            section
        )
        if m:
            params[key] = m.group(1)

    if corp_name == "KB금융":
        print(f"  [DEBUG KB금융] 추출 파라미터: {params}")

    if len(params) < 5:
        return None
    return params


def parse_ratio_from_viewer(rcept_no: str, corp_name: str):
    """DART 공시에서 보유비율 추출:
    dsaf001/main.do → JS 파라미터 파싱 → report/viewer.do 실제 섹션 HTML → 비율 추출
    """
    try:
        # 1) 메인 페이지 (JS에 viewer 파라미터 포함)
        main_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"
        res      = SESSION.get(main_url, timeout=15)

        params = parse_viewer_params(res.text, corp_name)
        if not params:
            return None

        # 2) 실제 '보유비율' 섹션 HTML 요청
        viewer_url = (
            f"https://dart.fss.or.kr/report/viewer.do"
            f"?rcpNo={rcept_no}"
            f"&dcmNo={params['dcmNo']}"
            f"&eleId={params['eleId']}"
            f"&offset={params['offset']}"
            f"&length={params['length']}"
            f"&dtd={params['dtd']}"
        )
        res2  = SESSION.get(viewer_url, timeout=15)
        ratio = extract_ratio(res2.text)
        return ratio

    except Exception as e:
        print(f"    [WARN] 파싱 실패 {corp_name} ({rcept_no}): {e}")
        return None


# ── 메인 ─────────────────────────────────────────────────────────
def fetch_all() -> list[dict]:
    if not KEY:
        print("  [ERROR] DART_API_KEY 환경변수 없음")
        return []
    print(f"  API 키: {'*'*8}{KEY[-4:]}")

    try:
        corp_map = enrich_corp_codes(DART_CORPS)
    except Exception as e:
        print(f"  [WARN] corpCode.xml 실패: {e} → 하드코딩 사용")
        corp_map = dict(DART_CORPS)

    stocks = []
    print(f"\n  국민연금 D001 공시 조회 + 뷰어 파싱 ({len(corp_map)}종목)...")

    for corp_name, corp_code in corp_map.items():
        try:
            filings = get_nps_filings(corp_code)
            if not filings:
                continue

            latest   = filings[0]
            rcept_no = latest.get("rcept_no", "")
            rcept_dt = latest.get("rcept_dt", "")

            ratio = parse_ratio_from_viewer(rcept_no, corp_name) if rcept_no else None
            if ratio is None:
                print(f"  - {corp_name:<22} 공시 있으나 비율 파싱 실패 ({rcept_no})")
                continue

            prev_ratio = ratio
            if len(filings) >= 2:
                prev_ratio = (
                    parse_ratio_from_viewer(filings[1]["rcept_no"], corp_name) or ratio
                )
            change = round(ratio - prev_ratio, 2)
            if len(rcept_dt) == 8:
                rcept_dt = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:]}"

            stocks.append({
                "name":     corp_name,
                "value":    round(ratio, 2),
                "change":   change,
                "amount":   f"지분율 {ratio:.2f}%",
                "rcept_dt": rcept_dt,
            })
            print(f"  ✓ {corp_name:<22} {ratio:.2f}%  변동 {change:+.2f}%  ({rcept_dt})")

        except Exception as e:
            print(f"  [ERROR] {corp_name}: {e}")
        time.sleep(0.3)

    stocks.sort(key=lambda x: x["value"], reverse=True)
    for i, s in enumerate(stocks, 1):
        s["rank"] = i
    return stocks


def main():
    print("=" * 55)
    print("  국민연금 포트폴리오 수집 (DART OpenAPI)")
    print("=" * 55)

    now_kst    = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")
    stocks     = fetch_all()

    if stocks:
        source = "금감원 DART — 주식대량보유상황보고(D001) + dart.fss.or.kr 뷰어 파싱"
    else:
        print("\n  ⚠ 수집 실패 — 빈 목록으로 저장 (fallback 없음)")
        source     = "수집 실패 — DART 공시 데이터 없음"
        updated_at += " [error]"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": updated_at,
            "source":     source,
            "stocks":     stocks,   # 실패 시 빈 배열
        }, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"  ✅ 완료: {len(stocks)}종목 | {updated_at}")
    print(f"  출처: {source}")
    print("=" * 55)


if __name__ == "__main__":
    main()
