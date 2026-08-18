"""
여기살래? - 온통청년 정책 API 어댑터
기존 get_policies()가 반환한 정책 리스트를,
recommendation_engine.ts의 buildDetailReportPrompt(reportInputs, policyHint)에
그대로 넣을 수 있는 텍스트 요약으로 바꾼다.

✅ 실제 호출로 확인된 사실 (2026-08-18):
   온통청년 API의 zipCd는 우편번호 체계라 우리 경계코드(행정표준코드)와 안 맞음.
   (예: zipCd=36010 검색하면 0건, 정책 하나가 zipCd="12110,12130,..." 처럼
    우편번호 여러 개를 콤마로 나열하는 방식으로 옴)
   대신 rgtrInstCdNm/operInstCdNm/sprvsnInstCdNm 필드에 "전남광주통합특별시"처럼
   우리 데이터셋과 동일한 표기의 지역명이 텍스트로 들어있어서, 이걸로 매칭한다.
   ※ 이 필드는 시도(광역) 단위까지만 구분되고 시군구(예: 목포시) 단위까지는
     안 내려가는 것으로 보임 — 그래서 "목포시 전용 정책"이 아니라
     "목포시가 속한 광역권(전남광주통합특별시) 정책"을 보여주는 형태가 된다.
     완벽한 시군구 단위 매칭은 아니지만, 지금 확보 가능한 것 중 가장 정확한 근사치.
"""
import os
import requests

API_KEY = os.getenv("YOUTH_API_KEY")
API_URL = "https://www.youthcenter.go.kr/go/ythip/getPlcy"

PAGE_SIZE = 100
MAX_RESULT = 5
MAX_PAGES_TO_SCAN = 10  # 전체 스캔 상한 (API 호출량 보호용, 최대 1000건 훑음)

# BasicInfo.ageGroup(types/user.ts의 AgeGroup)과 매핑되는 대표 나이.
AGE_GROUP_TO_REPRESENTATIVE_AGE = {
    "20-24": 22,
    "25-29": 27,
    "30-34": 32,
    "35-39": 37,
    "40+": 40,
}


def age_group_to_age(age_group: str) -> int:
    age = AGE_GROUP_TO_REPRESENTATIVE_AGE.get(age_group)
    if age is None:
        raise ValueError(f"알 수 없는 ageGroup: {age_group}")
    return age


def to_int(value):
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None


def is_age_eligible(policy, age):
    age_limit_yn = str(policy.get("sprtTrgtAgeLmtYn", "")).strip().upper()
    min_age = to_int(policy.get("sprtTrgtMinAge"))
    max_age = to_int(policy.get("sprtTrgtMaxAge"))

    if age_limit_yn == "N":
        return True
    if min_age is None and max_age is None:
        return False
    if min_age is not None and age < min_age:
        return False
    if max_age is not None and age > max_age:
        return False
    return True


def is_region_match(policy, sido_name: str) -> bool:
    """
    zipCd 대신 기관명 텍스트로 지역 매칭.
    sido_name 예: "전남광주통합특별시" (region_vectors_full.json의 region 앞부분,
    "전남광주통합특별시 목포시"에서 첫 단어)
    """
    if not sido_name:
        return False
    candidates = [
        policy.get("rgtrInstCdNm", ""),
        policy.get("operInstCdNm", ""),
        policy.get("sprvsnInstCdNm", ""),
    ]
    return any(sido_name in (c or "") for c in candidates)


def convert_policy(policy):
    return {
        "policyNo": policy.get("plcyNo"),
        "policyName": policy.get("plcyNm"),
        "category": policy.get("lclsfNm"),
        "subCategory": policy.get("mclsfNm"),
        "description": policy.get("plcyExplnCn"),
        "support": policy.get("plcySprtCn"),
        "minAge": to_int(policy.get("sprtTrgtMinAge")),
        "maxAge": to_int(policy.get("sprtTrgtMaxAge")),
        "ageLimitYn": policy.get("sprtTrgtAgeLmtYn"),
        "institutionName": policy.get("rgtrInstCdNm"),
        "applicationUrl": policy.get("aplyUrlAddr"),
        "referenceUrl": policy.get("refUrlAddr1"),
    }


def get_policies(sido_name, age, limit=MAX_RESULT):
    """
    지역명(시도 단위 텍스트, 예: "전남광주통합특별시")과 나이로 정책을 찾는다.
    zipCd 필터는 안 쓰고, 전체를 페이지 단위로 훑으면서 기관명 텍스트로 걸러낸다.
    """
    age = int(age)
    selected = []
    seen_policy_numbers = set()
    page_num = 1

    while len(selected) < limit and page_num <= MAX_PAGES_TO_SCAN:
        params = {
            "apiKeyNm": API_KEY,
            "pageNum": page_num,
            "pageSize": PAGE_SIZE,
            "rtnType": "json",
        }
        response = requests.get(API_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        if str(data.get("resultCode")) != "200":
            raise RuntimeError(
                data.get("resultMessage", data.get("errorMsg", "온통청년 API 오류"))
            )

        result = data.get("result", {})
        paging = result.get("pagging", {})
        policies = result.get("youthPolicyList", [])

        if not policies:
            break

        for policy in policies:
            if not is_region_match(policy, sido_name):
                continue
            if not is_age_eligible(policy, age):
                continue
            policy_no = policy.get("plcyNo")
            if policy_no and policy_no in seen_policy_numbers:
                continue
            if policy_no:
                seen_policy_numbers.add(policy_no)
            selected.append(convert_policy(policy))
            if len(selected) >= limit:
                break

        total_count = int(paging.get("totCount", 0))
        if page_num * PAGE_SIZE >= total_count:
            break
        page_num += 1

    return selected[:limit]


# ------------------------------------------------------------------
# 여기부터 여기살래 연동용 추가 코드
# ------------------------------------------------------------------
def format_policies_for_prompt(policies: list) -> str:
    """
    정책 리스트를 buildDetailReportPrompt()의 policyHint 값으로 쓸
    한 문단 텍스트로 요약. LLM이 이 텍스트를 그대로 자연어로 풀어 쓸 재료가 됨.
    """
    if not policies:
        return "이 지역에 적용 가능한 청년정책을 찾지 못했습니다."

    lines = []
    for p in policies:
        name = p.get("policyName") or "이름 미상 정책"
        support = (p.get("support") or "").strip()
        support = support[:80] + "..." if len(support) > 80 else support
        category = p.get("category") or ""
        lines.append(f"- [{category}] {name}: {support}")

    return "\n".join(lines)


def extract_sido_name(region_full_name: str) -> str:
    """
    "전남광주통합특별시 목포시" → "전남광주통합특별시" (첫 단어, 시도 단위)
    region_vectors_full.json의 region 필드가 항상 "시도 시군구" 형태라 이걸로 충분함.
    """
    return region_full_name.split(" ")[0] if region_full_name else ""


def get_policy_hint_for_region(region_name: str, age_group: str) -> dict:
    """
    recommend() 결과의 지역명(예: "전남광주통합특별시 목포시") + 유저 ageGroup을 받아서,
    TS의 policyHint: Partial<Record<string, string>> 형태 조각 하나를 만들어 반환.
    region_code는 더 이상 안 씀 (zipCd가 우리 코드 체계와 안 맞아서 폐기 — 위 설명 참고).
    사용 예: policy_hint.update(get_policy_hint_for_region(...))
    """
    age = age_group_to_age(age_group)
    sido_name = extract_sido_name(region_name)
    policies = get_policies(sido_name, age)
    return {region_name: format_policies_for_prompt(policies)}


if __name__ == "__main__":
    # 로컬 테스트용. YOUTH_API_KEY 환경변수 설정 후 실행.
    # export YOUTH_API_KEY="발급받은키"
    # python policy_adapter.py
    sample_region_name = "전남광주통합특별시 목포시"
    sample_age_group = "25-29"
    hint = get_policy_hint_for_region(sample_region_name, sample_age_group)
    print(hint)

# ------------------------------------------------------------------
# TS 연동 예시 (개발2 백엔드에서 이 파이썬을 API 엔드포인트로 감싼 경우)
# ------------------------------------------------------------------
"""
프론트(TypeScript)에서는 이렇게 부르면 됨:

// 1) Top1 지역의 정책 요약을 백엔드(Flask/FastAPI 등)에서 받아옴
const res = await fetch(`/api/policy?region_name=${encodeURIComponent(top1.region)}&age_group=${basicInfo.ageGroup}`);
const { policyHint } = await res.json();
// policyHint = { "전남광주통합특별시 목포시": "- [일자리] ...\\n- [금융복지] ..." }

// 2) buildDetailReportPrompt에 그대로 전달
const prompt = buildDetailReportPrompt(reportInputs, policyHint);

백엔드(Python) 쪽 엔드포인트 예시(FastAPI):

from fastapi import FastAPI
from policy_adapter import get_policy_hint_for_region

app = FastAPI()

@app.get("/api/policy")
def policy_endpoint(region_name: str, age_group: str):
    return {"policyHint": get_policy_hint_for_region(region_name, age_group)}
"""

