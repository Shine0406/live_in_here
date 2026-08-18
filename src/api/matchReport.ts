import type { UserProfile } from '../types/user'
import type { MatchReport } from '../utils/matchReport'
import type { Vector } from '../utils/recommendation_engine'

export interface MatchReportRequest {
  userVector: Vector
  region: {
    name: string
    vector: Vector
  }
  basicInfo: UserProfile
  matchPercent: number
}

export async function fetchMatchReport(
  payload: MatchReportRequest,
  signal?: AbortSignal,
): Promise<MatchReport> {
  const response = await fetch('/api/match-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) throw new Error(`매칭 리포트 생성 실패 (${response.status})`)

  const data: unknown = await response.json()
  if (
    typeof data !== 'object' || data === null ||
    !('summary' in data) || typeof data.summary !== 'string' ||
    !('detail' in data) || typeof data.detail !== 'string' ||
    !data.summary.trim() || !data.detail.trim()
  ) {
    throw new Error('매칭 리포트 응답 형식이 올바르지 않습니다.')
  }

  return { summary: data.summary, detail: data.detail }
}
