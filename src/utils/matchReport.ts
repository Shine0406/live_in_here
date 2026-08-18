import type { Axis, Vector } from './recommendation_engine'

export interface MatchReport {
  summary: string
  detail: string
}

const AXES: Axis[] = ['H', 'T', 'I', 'C', 'E', 'J']
const AXIS_LABELS: Record<Axis, string> = {
  H: '주거',
  T: '교통',
  I: '생활 인프라',
  C: '문화',
  E: '자연환경',
  J: '일자리',
}

function sortedAxes(vector: Vector, direction: 'high' | 'low') {
  return [...AXES].sort((a, b) => (
    direction === 'high' ? vector[b] - vector[a] : vector[a] - vector[b]
  ))
}

export function createFallbackMatchReport(
  regionName: string,
  userVector: Vector,
  regionVector: Vector,
): MatchReport {
  const userHigh = sortedAxes(userVector, 'high').slice(0, 2)
  const userLow = sortedAxes(userVector, 'low')[0]
  const regionHigh = sortedAxes(regionVector, 'high').slice(0, 2)
  const regionLow = sortedAxes(regionVector, 'low')[0]
  const similar = [...AXES]
    .sort((a, b) => (
      Math.abs(userVector[a] - regionVector[a]) - Math.abs(userVector[b] - regionVector[b])
    ))
    .slice(0, 2)

  return {
    summary: `${regionName}의 상대적으로 높은 지표는 ${AXIS_LABELS[regionHigh[0]]} · ${AXIS_LABELS[regionHigh[1]]}입니다. 당신의 높은 성향 지표는 ${AXIS_LABELS[userHigh[0]]} · ${AXIS_LABELS[userHigh[1]]}이며, 실제 지표를 기준으로 매칭되었어요.`,
    detail: `당신의 높은 성향 지표는 ${AXIS_LABELS[userHigh[0]]} · ${AXIS_LABELS[userHigh[1]]}이고, 상대적으로 낮은 지표는 ${AXIS_LABELS[userLow]}입니다. ${regionName}의 강점 지표는 ${AXIS_LABELS[regionHigh[0]]} · ${AXIS_LABELS[regionHigh[1]]}이며, 사용자와 지역은 ${AXIS_LABELS[similar[0]]} · ${AXIS_LABELS[similar[1]]} 지표에서 차이가 비교적 작습니다. 지역의 ${AXIS_LABELS[regionLow]} 지표는 다른 항목보다 낮으므로 실제 정착 전 관련 여건을 추가로 확인해보세요.`,
  }
}
