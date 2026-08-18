import type { RegionEntry } from '../utils/recommendation_engine'
import raw from './region_vectors_full.json'

interface RawRegionRecord {
  region: string
  code: string | null
  budgetProxy: number | null
  vector: { H: number; T: number; I: number; C: number; E: number; J: number }
  jNote: string
}

export interface RegionData extends RegionEntry {
  jNote: string
}

/**
 * 실제 공공데이터(월세·버스·문화시설·녹지) 기반 229개 시군구 지역 벡터.
 * H/T/I/C/E는 실측값, J(일자리)는 고용24 API 개인회원 접근 제한으로
 * T·I축 기반 합성값을 임시로 사용 중 (region_vectors_full.json의 jNote 필드 참고).
 */
export const REAL_REGIONS: RegionData[] = (raw as RawRegionRecord[]).map((r) => ({
  region: r.region,
  code: r.code ?? undefined,
  budgetProxy: r.budgetProxy ?? undefined,
  vector: r.vector,
  jNote: r.jNote,
}))

export function findRegionByCode(code: string | undefined, regionName?: string | null): RegionData | undefined {
  if (!code) return undefined
  let decodedCode = code
  try {
    decodedCode = decodeURIComponent(code)
  } catch {
    // 잘못 인코딩된 URL은 원본 값으로 조회하고, 없으면 not-found 화면에서 처리한다.
  }
  return REAL_REGIONS.find(
    (region) => region.code === decodedCode && (!regionName || region.region === regionName),
  )
}

export function getRegionPath(region: RegionData): string {
  const path = `/region/${encodeURIComponent(region.code ?? '')}`
  const hasDuplicateCode = REAL_REGIONS.some(
    (candidate) => candidate !== region && candidate.code === region.code,
  )
  return hasDuplicateCode ? `${path}?region=${encodeURIComponent(region.region)}` : path
}
