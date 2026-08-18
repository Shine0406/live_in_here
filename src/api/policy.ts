export interface YouthPolicy {
  policyNo: string | null
  policyName: string
  category: string | null
  subCategory: string | null
  description: string | null
  support: string | null
  minAge: number | null
  maxAge: number | null
  ageLimitYn: string | null
  institutionName: string | null
  applicationUrl: string | null
  referenceUrl: string | null
}

export interface PolicyResponse {
  policies: YouthPolicy[]
  regionScope: string
  matchedSido: string
}

export async function fetchPolicies(
  regionName: string,
  ageGroup: string,
  signal?: AbortSignal,
): Promise<PolicyResponse> {
  const query = new URLSearchParams({ region_name: regionName, age_group: ageGroup })
  const response = await fetch(`/api/policy?${query.toString()}`, { signal })
  if (!response.ok) throw new Error(`정책 조회 실패 (${response.status})`)

  const data: unknown = await response.json()
  if (
    typeof data !== 'object' || data === null ||
    !('policies' in data) || !Array.isArray(data.policies) ||
    !('regionScope' in data) || typeof data.regionScope !== 'string' ||
    !('matchedSido' in data) || typeof data.matchedSido !== 'string'
  ) throw new Error('정책 응답 형식이 올바르지 않습니다.')

  return data as PolicyResponse
}
