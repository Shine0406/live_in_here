import type { RegionEntry } from '../utils/recommendation_engine'
import raw from './region_vectors_full.json'

interface RawRegionRecord {
  region: string
  code: string | null
  budgetProxy: number | null
  vector: { H: number; T: number; I: number; C: number; E: number; J: number }
  jNote: string
}

/**
 * 실제 공공데이터(월세·버스·문화시설·녹지) 기반 229개 시군구 지역 벡터.
 * H/T/I/C/E는 실측값, J(일자리)는 고용24 API 개인회원 접근 제한으로
 * T·I축 기반 합성값을 임시로 사용 중 (region_vectors_full.json의 jNote 필드 참고).
 */
export const REAL_REGIONS: RegionEntry[] = (raw as RawRegionRecord[]).map((r) => ({
  region: r.region,
  code: r.code ?? undefined,
  budgetProxy: r.budgetProxy ?? undefined,
  vector: r.vector,
}))
