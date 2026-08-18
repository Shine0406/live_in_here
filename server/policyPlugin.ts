import type { Plugin } from 'vite'

const POLICY_API_URL = 'https://www.youthcenter.go.kr/go/ythip/getPlcy'
const PAGE_SIZE = 100
const MAX_PAGES_TO_SCAN = 10
const MAX_RESULT = 5

interface PolicyPluginOptions { apiKey?: string }

interface RawPolicy {
  plcyNo?: unknown
  plcyNm?: unknown
  lclsfNm?: unknown
  mclsfNm?: unknown
  plcyExplnCn?: unknown
  plcySprtCn?: unknown
  sprtTrgtMinAge?: unknown
  sprtTrgtMaxAge?: unknown
  sprtTrgtAgeLmtYn?: unknown
  rgtrInstCdNm?: unknown
  operInstCdNm?: unknown
  sprvsnInstCdNm?: unknown
  aplyUrlAddr?: unknown
  refUrlAddr1?: unknown
  refUrlAddr2?: unknown
}

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

const AGE_BY_GROUP: Record<string, number> = {
  '20-24': 22,
  '25-29': 27,
  '30-34': 32,
  '35-39': 37,
  '40+': 40,
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function toNumber(value: unknown): number | null {
  const text = toText(value)
  if (text === null) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

function isAgeEligible(policy: RawPolicy, age: number): boolean {
  const ageLimitYn = (toText(policy.sprtTrgtAgeLmtYn) ?? '').toUpperCase()
  if (ageLimitYn === 'N') return true
  const minAge = toNumber(policy.sprtTrgtMinAge)
  const maxAge = toNumber(policy.sprtTrgtMaxAge)
  if (minAge === null && maxAge === null) return false
  return (minAge === null || age >= minAge) && (maxAge === null || age <= maxAge)
}

function matchesSido(policy: RawPolicy, sido: string): boolean {
  const institutions = [policy.rgtrInstCdNm, policy.operInstCdNm, policy.sprvsnInstCdNm]
    .map(toText)
    .filter((value): value is string => value !== null)
  return institutions.some((institution) => institution.includes(sido))
}

function convertPolicy(policy: RawPolicy): YouthPolicy | null {
  const policyName = toText(policy.plcyNm)
  if (!policyName) return null
  const institutions = [policy.operInstCdNm, policy.rgtrInstCdNm, policy.sprvsnInstCdNm]
    .map(toText)
    .find((value): value is string => value !== null) ?? null
  return {
    policyNo: toText(policy.plcyNo),
    policyName,
    category: toText(policy.lclsfNm),
    subCategory: toText(policy.mclsfNm),
    description: toText(policy.plcyExplnCn),
    support: toText(policy.plcySprtCn),
    minAge: toNumber(policy.sprtTrgtMinAge),
    maxAge: toNumber(policy.sprtTrgtMaxAge),
    ageLimitYn: toText(policy.sprtTrgtAgeLmtYn),
    institutionName: institutions,
    applicationUrl: toText(policy.aplyUrlAddr),
    referenceUrl: toText(policy.refUrlAddr1) ?? toText(policy.refUrlAddr2),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function writeJson(response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export function policyPlugin(options: PolicyPluginOptions): Plugin {
  return {
    name: 'youth-policy-api',
    configureServer(server) {
      server.middlewares.use('/api/policy', async (request, response) => {
        if (request.method !== 'GET') {
          writeJson(response, 405, { error: 'GET 요청만 지원합니다.' })
          return
        }
        const query = new URL(request.url ?? '/', 'http://localhost').searchParams
        const regionName = query.get('region_name')?.trim()
        const ageGroup = query.get('age_group')?.trim()
        if (!regionName || !ageGroup || AGE_BY_GROUP[ageGroup] === undefined) {
          writeJson(response, 400, { error: 'region_name과 올바른 age_group이 필요합니다.' })
          return
        }
        if (!options.apiKey) {
          writeJson(response, 503, { error: 'YOUTH_API_KEY가 설정되지 않았습니다.' })
          return
        }

        const sido = regionName.split(/\s+/)[0]
        const age = AGE_BY_GROUP[ageGroup]
        const selected: YouthPolicy[] = []
        const seenPolicyNumbers = new Set<string>()

        try {
          for (let pageNum = 1; pageNum <= MAX_PAGES_TO_SCAN && selected.length < MAX_RESULT; pageNum += 1) {
            const params = new URLSearchParams({
              apiKeyNm: options.apiKey,
              pageNum: String(pageNum),
              pageSize: String(PAGE_SIZE),
              rtnType: 'json',
            })
            const externalResponse = await fetch(`${POLICY_API_URL}?${params.toString()}`)
            if (!externalResponse.ok) throw new Error(`온통청년 API HTTP ${externalResponse.status}`)
            const payload = asRecord(await externalResponse.json())
            if (payload.resultCode !== undefined && String(payload.resultCode) !== '200') {
              throw new Error(toText(payload.resultMessage) ?? toText(payload.errorMsg) ?? '온통청년 API 오류')
            }
            const result = asRecord(payload.result)
            const policies = Array.isArray(result.youthPolicyList) ? result.youthPolicyList as RawPolicy[] : []
            if (policies.length === 0) break

            for (const policy of policies) {
              if (!isAgeEligible(policy, age) || !matchesSido(policy, sido)) continue
              const policyNo = toText(policy.plcyNo)
              if (policyNo && seenPolicyNumbers.has(policyNo)) continue
              if (policyNo) seenPolicyNumbers.add(policyNo)
              const converted = convertPolicy(policy)
              if (converted) selected.push(converted)
              if (selected.length >= MAX_RESULT) break
            }

            const paging = asRecord(result.pagging)
            const totalCount = toNumber(paging.totCount)
            if (totalCount !== null && pageNum * PAGE_SIZE >= totalCount) break
          }

          writeJson(response, 200, {
            policies: selected.slice(0, MAX_RESULT),
            regionScope: '시도 단위 정책 매칭',
            matchedSido: sido,
          })
        } catch (error) {
          console.error('정책 API 오류:', error instanceof Error ? error.message : '알 수 없는 오류')
          writeJson(response, 502, { error: '정책 정보를 불러오지 못했습니다.' })
        }
      })
    },
  }
}
