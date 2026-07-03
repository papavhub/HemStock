"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI
전략:
  1) list.json에서 flr_nm=국민연금 + pblntf_detail_ty=D001 로 전체 공시 검색
     → 종목 하드코딩 없이 국민연금이 제출한 모든 주식대량보유상황보고 취득
  2) 종목별 최신 공시만 추려서 dart.fss.or.kr 뷰어 HTML 파싱 → 보유비율 추출
  3) 이전 nps.json이 있으면 DART 장애 시 fallback으로 유지

환경변수: DART_API_KEY (GitHub Secret)
결과: public/data/nps.json
"""

import io
import json
import os
import re
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
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


# ── Step 1: 국민연금 공시 전체 목록 (flr_nm 검색) ────────────────
def fetch_nps_all_filings() -> list[dict]:
    """DART list.json에서 국민연금이 제출한 D001 공시 전체 수집 (최근 1년, 최대 5페이지)"""
    now    = datetime.now(KST)
    end_de = now.strftime("%Y%m%d")
    bgn_de = (now - timedelta(days=90)).strftime("%Y%m%d")

    all_items = []
    for page in range(1, 6):
        params = {
            "crtfc_key":        KEY,
            "pblntf_detail_ty": "D001",
            "flr_nm":           "국민연금",
            "bgn_de":           bgn_de,
            "end_de":           end_de,
            "page_no":          str(page),
            "page_count":       "40",
        }
        res  = SESSION.get("https://opendart.fss.or.kr/api/list.json", params=params, timeout=30)
        data = res.json()

        status = data.get("status")
        if status == "013":   # 데이터 없음 (마지막 페이지 이후)
            break
        if status != "000":
            print(f"  [WARN] list.json page={page} status={status}: {data.get('message','')}")
            break

        items = data.get("list", [])
        all_items.extend(items)
        print(f"  page {page}: {len(items)}건 (누계 {len(all_items)}건)")

        total_page = int(data.get("total_page", 1))
        if page >= total_page:
            break

    return all_items


def latest_per_corp(items: list[dict]) -> dict[str, dict]:
    """종목별 최신 공시 1건만 추출 (corp_name → filing)"""
    by_corp: dict[str, dict] = {}
    for item in items:
        name = item.get("corp_name", "").strip()
        if not name:
            continue
        existing = by_corp.get(name)
        if existing is None or item.get("rcept_dt", "") > existing.get("rcept_dt", ""):
            by_corp[name] = item
    return by_corp


# ── Step 2: DART 뷰어 HTML → 보유비율 추출 ──────────────────────
def parse_viewer_params(html: str):
    text_m = re.search(
        r"(node\w+)\[.text.\]\s*=\s*[\"'][^\"']*보유비율[^\"']*[\"']",
        html
    )
    if not text_m:
        return None

    var_name  = text_m.group(1)
    start_pos = text_m.start()
    section   = html[start_pos : start_pos + 800]

    params = {}
    for key in ("dcmNo", "eleId", "offset", "length", "dtd"):
        m = re.search(
            rf"{re.escape(var_name)}\[.{key}.\]\s*=\s*[\"']([^\"']+)[\"']",
            section
        )
        if m:
            params[key] = m.group(1)

    return params if len(params) >= 5 else None


def extract_ratio(text: str):
    soup = BeautifulSoup(text, "html.parser")

    # ① 국민연금 행에서 직접 추출
    best_ratio = None
    for row in soup.find_all("tr"):
        row_text = row.get_text()
        if "국민연금" not in row_text:
            continue
        tds = row.find_all("td")
        row_ratios = []
        for td in tds:
            raw = td.get_text(strip=True).replace(",", "").replace("%", "").replace("％", "")
            try:
                v = float(raw)
                if 5.0 <= v <= 25.0:
                    row_ratios.append(v)
            except ValueError:
                pass
        if row_ratios:
            if "이번보고서" in row_text:
                return row_ratios[0]
            best_ratio = row_ratios[0]

    if best_ratio is not None:
        return best_ratio

    # ② 보유비율/지분율 인접 셀
    for cell in soup.find_all(["td", "th"]):
        cell_txt = cell.get_text(strip=True).replace(" ", "")
        if any(kw in cell_txt for kw in ("보유비율", "보유 비율", "지분율", "보유주식비율")):
            for sibling in [cell.find_next_sibling("td"), cell.find_next("td")]:
                if sibling is None:
                    continue
                raw = sibling.get_text(strip=True).replace(",", "").replace("%", "").replace("％", "").strip()
                try:
                    v = float(raw)
                    if 5.0 <= v <= 25.0:
                        return v
                except ValueError:
                    m = re.search(r"([0-9]+\.[0-9]{1,4})", raw)
                    if m:
                        v = float(m.group(1))
                        if 5.0 <= v <= 25.0:
                            return v

    # ③ XBRL 태그
    for tag in ("holdRto", "bndtRto", "posesnStockRto"):
        m = re.search(rf"<{tag}[^>]*>\s*([0-9]+\.[0-9]+)\s*</{tag}>", text, re.I)
        if m:
            v = float(m.group(1))
            if 5.0 <= v <= 25.0:
                return v

    # ④ 보유비율 + % 패턴
    m = re.search(r"보유\s*비율[^0-9<]{0,60}([0-9]+\.[0-9]{1,4})\s*(?:%|％)", text)
    if m:
        v = float(m.group(1))
        if 5.0 <= v <= 25.0:
            return v

    return None


def parse_ratio_from_viewer(rcept_no: str, corp_name: str):
    try:
        main_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"
        res      = SESSION.get(main_url, timeout=15)
        params   = parse_viewer_params(res.text)
        if not params:
            return None

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
        return extract_ratio(res2.text)

    except Exception as e:
        print(f"    [WARN] 뷰어 파싱 실패 {corp_name} ({rcept_no}): {e}")
        return None


# ── 메인 ─────────────────────────────────────────────────────────
def fetch_all() -> list[dict]:
    if not KEY:
        print("  [ERROR] DART_API_KEY 환경변수 없음")
        return []
    print(f"  API 키: {'*'*8}{KEY[-4:]}")

    print("\n  국민연금 D001 공시 전체 조회 (flr_nm=국민연금)...")
    all_filings = fetch_nps_all_filings()
    if not all_filings:
        print("  [WARN] 공시 0건 — DART 서버 문제 또는 최근 공시 없음")
        return []

    by_corp = latest_per_corp(all_filings)
    print(f"\n  종목별 최신 공시 {len(by_corp)}건 → 보유비율 파싱 시작...\n")

    def fetch_one(corp_name: str, filing: dict):
        rcept_no = filing.get("rcept_no", "")
        rcept_dt = filing.get("rcept_dt", "")
        if not rcept_no:
            return None
        ratio = parse_ratio_from_viewer(rcept_no, corp_name)
        if ratio is None:
            print(f"  - {corp_name:<22} 비율 파싱 실패")
            return None
        if len(rcept_dt) == 8:
            rcept_dt = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:]}"
        print(f"  ✓ {corp_name:<22} {ratio:.2f}%  ({rcept_dt})")
        return {
            "name":     corp_name,
            "value":    round(ratio, 2),
            "change":   0,
            "amount":   f"지분율 {ratio:.2f}%",
            "rcept_dt": rcept_dt,
        }

    stocks = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(fetch_one, name, filing): name
            for name, filing in by_corp.items()
        }
        for future in as_completed(futures):
            result = future.result()
            if result:
                stocks.append(result)

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

    stocks = fetch_all()

    if stocks:
        source     = "금감원 DART — 주식대량보유상황보고(D001) + dart.fss.or.kr 뷰어 파싱"
        payload    = {"updated_at": updated_at, "source": source, "stocks": stocks}
    else:
        # DART 장애 시: 이전 데이터 유지
        if OUTPUT_PATH.exists():
            try:
                with open(OUTPUT_PATH, encoding="utf-8") as f:
                    old = json.load(f)
                if old.get("stocks"):
                    print("\n  ⚠ 수집 실패 — 이전 데이터 유지")
                    old["updated_at"] += " (DART 장애 — 이전 데이터)"
                    payload = old
                    OUTPUT_PATH.write_text(
                        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
                    )
                    print(f"\n{'='*55}")
                    print(f"  ✅ 이전 데이터 유지: {len(old['stocks'])}종목")
                    print("=" * 55)
                    return
            except Exception:
                pass
        print("\n  ⚠ 수집 실패 + 이전 데이터 없음 — 빈 목록 저장")
        payload = {
            "updated_at": updated_at + " [error]",
            "source":     "수집 실패 — DART 공시 데이터 없음",
            "stocks":     [],
        }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'='*55}")
    print(f"  ✅ 완료: {len(stocks)}종목 | {updated_at}")
    print(f"  출처: {payload['source']}")
    print("=" * 55)


if __name__ == "__main__":
    main()
