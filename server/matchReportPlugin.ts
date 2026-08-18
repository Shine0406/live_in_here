import OpenAI from 'openai'
import type { Plugin } from 'vite'

interface MatchReportPluginOptions {
  apiKey?: string
  baseURL?: string
  model?: string
}

interface MatchReportPayload {
  userVector: Record<string, number>
  region: { name: string; vector: Record<string, number> }
  basicInfo: Record<string, unknown>
  matchPercent: number
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return typeof value === 'object' && value !== null &&
    Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))
}

function isValidPayload(value: unknown): value is MatchReportPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<MatchReportPayload>
  return isNumberRecord(payload.userVector) &&
    typeof payload.region === 'object' && payload.region !== null &&
    typeof payload.region.name === 'string' &&
    isNumberRecord(payload.region.vector) &&
    typeof payload.basicInfo === 'object' && payload.basicInfo !== null &&
    typeof payload.matchPercent === 'number' && Number.isFinite(payload.matchPercent)
}

async function readJsonBody(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('요청 본문이 너무 큽니다.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function writeJson(response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export function matchReportPlugin(options: MatchReportPluginOptions): Plugin {
  return {
    name: 'match-report-api',
    configureServer(server) {
      server.middlewares.use('/api/match-report', async (request, response) => {
        if (request.method !== 'POST') {
          writeJson(response, 405, { error: 'POST 요청만 지원합니다.' })
          return
        }
        if (!options.apiKey) {
          writeJson(response, 503, { error: 'OPENAI_API_KEY가 설정되지 않았습니다.' })
          return
        }

        try {
          const payload = await readJsonBody(request)
          if (!isValidPayload(payload)) {
            writeJson(response, 400, { error: '요청 데이터 형식이 올바르지 않습니다.' })
            return
          }

          const client = new OpenAI({
            apiKey: options.apiKey,
            ...(options.baseURL ? { baseURL: options.baseURL } : {}),
          })
          const completion = await client.chat.completions.create({
            model: options.model || 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `너는 "여기살래?" 지역 정착 매칭 서비스의 결과 설명을 작성한다.
입력에는 사용자 기본정보, 사용자 성향 벡터, 추천 지역명과 지역 벡터, 기존 추천 알고리즘이 계산한 적합도가 제공된다.

축 의미: H=주거, T=교통, I=생활 인프라, C=문화, E=자연환경, J=일자리.
각 점수는 0~100 범위의 정규화된 상대 지표이며, 높을수록 해당 특성이 상대적으로 강하다. 절대 품질이나 전국 순위를 뜻하지 않는다.
J는 실시간 채용공고 수가 아닐 수 있으므로 취업하기 좋다거나 일자리가 풍부하다고 단정하지 말고 "일자리 관련 지표"라고 표현한다.

반드시 입력 데이터만 사용한다. 교통 시간, 시설 수, 인구 변화, 기업·채용공고, 실제 월세, 정책 등 제공되지 않은 지역 사실을 추측하지 않는다. 전국 최고, 상위 몇 퍼센트, 다른 지역보다 우수하다는 표현도 금지한다. H/T/I/C/E/J 문자를 사용자 문장에 그대로 노출하지 않는다.

summary는 지역명을 포함한 자연스러운 한국어 2문장, 약 80~160자로 작성한다. 지역의 높은 지표와 사용자의 주요 성향을 친근하고 신뢰감 있게 연결한다.
detail은 자연스러운 한국어 3~5문장으로 작성한다. 사용자 성향을 먼저 설명하고 지역과 잘 맞는 지표, 점수 패턴이 유사한 부분, 필요하면 상대적으로 낮은 지표 하나를 부드러운 고려사항으로 설명한다.

summary와 detail이라는 non-empty 문자열 필드만 가진 JSON 객체를 반환하고 다른 텍스트나 마크다운은 출력하지 않는다.`,
              },
              {
                role: 'user',
                content: JSON.stringify(payload),
              },
            ],
          })
          const content = completion.choices[0]?.message?.content
          if (!content) throw new Error('LLM 응답이 비어 있습니다.')
          const report: unknown = JSON.parse(content)
          if (
            typeof report !== 'object' || report === null ||
            !('summary' in report) || typeof report.summary !== 'string' ||
            !('detail' in report) || typeof report.detail !== 'string'
          ) throw new Error('LLM 응답 형식이 올바르지 않습니다.')

          writeJson(response, 200, { summary: report.summary, detail: report.detail })
        } catch (error) {
          console.error('매칭 리포트 API 오류:', error instanceof Error ? error.message : '알 수 없는 오류')
          writeJson(response, 502, { error: '매칭 리포트를 생성하지 못했습니다.' })
        }
      })
    },
  }
}
