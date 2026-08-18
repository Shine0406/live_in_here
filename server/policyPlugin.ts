import type { Plugin } from 'vite'

const POLICY_API_URL = 'https://www.youthcenter.go.kr/opi/youthPlcyList.do'
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

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function readXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]).trim() || null : null
}

function parseXmlPolicies(xml: string): RawPolicy[] {
  const fields: Array<keyof RawPolicy> = [
    'plcyNo', 'plcyNm', 'lclsfNm', 'mclsfNm', 'plcyExplnCn', 'plcySprtCn',
    'sprtTrgtMinAge', 'sprtTrgtMaxAge', 'sprtTrgtAgeLmtYn', 'rgtrInstCdNm',
    'operInstCdNm', 'sprvsnInstCdNm', 'aplyUrlAddr', 'refUrlAddr1', 'refUrlAddr2',
  ]
  const blocks = [...xml.matchAll(/<(?:youthPolicy|item)(?:\s[^>]*)?>([\s\S]*?)<\/(?:youthPolicy|item)>/gi)]
    .map((match) => match[1])

  if (blocks.length === 0) {
    const starts = [...xml.matchAll(/<plcyNo(?:\s[^>]*)?>/gi)].map((match) => match.index ?? 0)
    starts.forEach((start, index) => blocks.push(xml.slice(start, starts[index + 1] ?? xml.length)))
  }

  return blocks.map((block) => Object.fromEntries(
    fields.map((field) => [field, readXmlTag(block, field)]),
  ) as RawPolicy).filter((policy) => toText(policy.plcyNm) !== null)
}

function findJsonPolicies(value: unknown): RawPolicy[] {
  if (Array.isArray(value)) {
    if (value.some((item) => toText(asRecord(item).plcyNm) !== null)) return value as RawPolicy[]
    for (const item of value) {
      const found = findJsonPolicies(item)
      if (found.length > 0) return found
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) {
      const found = findJsonPolicies(child)
      if (found.length > 0) return found
    }
  }
  return []
}

function findJsonNumber(value: unknown, keys: string[]): number | null {
  if (typeof value !== 'object' || value === null) return null
  const record = asRecord(value)
  for (const key of keys) {
    const number = toNumber(record[key])
    if (number !== null) return number
  }
  for (const child of Object.values(record)) {
    const number = findJsonNumber(child, keys)
    if (number !== null) return number
  }
  return null
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
          for (let pageIndex = 1; pageIndex <= MAX_PAGES_TO_SCAN && selected.length < MAX_RESULT; pageIndex += 1) {
            const params = new URLSearchParams({
              openApiVlak: options.apiKey,
              pageIndex: String(pageIndex),
              display: String(PAGE_SIZE),
            })
            const requestUrl = `${POLICY_API_URL}?${params.toString()}`
            if (pageIndex === 1) {
              const maskedParams = new URLSearchParams(params)
              maskedParams.set('openApiVlak', '***')
              console.info(`온통청년 요청: ${POLICY_API_URL}?${maskedParams.toString()}`)
              console.info(`YOUTH_API_KEY configured: ${Boolean(options.apiKey)}`)
            }
            const externalResponse = await fetch(requestUrl, {
              redirect: 'manual',
              headers: {
                Accept: 'application/xml, text/xml, application/json;q=0.9, */*;q=0.8',
                'User-Agent': 'Mozilla/5.0',
              },
            })
            const contentType = externalResponse.headers.get('content-type') ?? 'unknown'
            const responseText = await externalResponse.text()
            if (!externalResponse.ok) {
              const location = (externalResponse.headers.get('location') ?? '없음').replaceAll(options.apiKey, '***')
              const preview = responseText.slice(0, 300).replaceAll(options.apiKey, '***').replace(/\s+/g, ' ').trim()
              console.info(`온통청년 응답 status: ${externalResponse.status} ${externalResponse.statusText}`)
              console.info(`온통청년 redirect location: ${location}`)
              console.info(`온통청년 content-type: ${contentType}`)
              console.info(`온통청년 HTML preview: ${preview}`)
              throw new Error(`온통청년 API HTTP ${externalResponse.status} (${contentType})`)
            }
            const isJson = contentType.includes('json') || responseText.trimStart().startsWith('{')
            const payload = isJson ? JSON.parse(responseText) as unknown : null
            const payloadRecord = asRecord(payload)
            if (payloadRecord.resultCode !== undefined && String(payloadRecord.resultCode) !== '200') {
              throw new Error(toText(payloadRecord.resultMessage) ?? toText(payloadRecord.errorMsg) ?? '온통청년 API 오류')
            }
            const policies = isJson ? findJsonPolicies(payload) : parseXmlPolicies(responseText)
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

            const totalCount = isJson
              ? findJsonNumber(payload, ['totCount', 'totalCount', 'totalCnt'])
              : toNumber(readXmlTag(responseText, 'totCount') ?? readXmlTag(responseText, 'totalCount') ?? readXmlTag(responseText, 'totalCnt'))
            if (totalCount !== null && pageIndex * PAGE_SIZE >= totalCount) break
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
