/**
 * 여기살래? — 추천 엔진 
 *
 * 축: H(주거비) T(교통) I(생활인프라) C(문화향유) E(자연환경) [J(일자리)는 선택]
 * region_vectors.json (개발2 산출물)을 그대로 로드해서 쓰는 걸 전제로 설계함.
 */

// ------------------------------------------------------------------
// 0. 타입 정의
// ------------------------------------------------------------------
export type Axis = "H" | "T" | "I" | "C" | "E" | "J";

export type Vector = Record<Axis, number>; // 0~100

export interface BasicInfo {
  ageGroup: string; // "20대" "30대" ...
  jobField: string; // 희망 직무 대분류
  budgetMax: number; // 월 주거비 예산 상한 
  hasCar: boolean;
}

export interface QuestionOption {
  id: "A" | "B" | "C" | "D";
  label: string;
  delta: Partial<Record<Axis, number>>; // 선택 시 가산/감산 점수
}

export interface Question {
  id: string; // "Q1" ~ "Q15"
  axisGroup: Axis; // 주 소속 축 (문서 표기용)
  prompt: string;
  options: [QuestionOption, QuestionOption, QuestionOption, QuestionOption];
}

export interface RegionEntry {
  region: string; // "서울특별시 종로구"
  code?: string; // 경계코드
  budgetProxy?: number; // Hard Filter용 주거비 실측치. 없으면 H축 역산 사용
  vector: Vector;
}

export interface MatchResult {
  region: string;
  similarity: number; // 0~1
  vector: Vector;
}

// ------------------------------------------------------------------
// 1. 15문항 정의 (확정본, A/B/C/D 4지선다 — 각 축 +2/+1/-1/-2 그라데이션)
// ------------------------------------------------------------------
export const QUESTIONS: Question[] = [
  {
    id: "Q1", axisGroup: "H", prompt: "주거비, 나에게 더 중요한 건?",
    options: [
      { id: "A", label: "무조건 저렴한 게 최고다", delta: { H: 2 } },
      { id: "B", label: "낡아도 저렴하면 괜찮다", delta: { H: 1 } },
      { id: "C", label: "조금 비싸도 신축이 좋다", delta: { H: -1 } },
      { id: "D", label: "넓고 쾌적한 공간이 우선이다", delta: { H: -2, I: 1 } },
    ]
  },
  {
    id: "Q2", axisGroup: "H", prompt: "내 집 마련 계획은?",
    options: [
      { id: "A", label: "5년 내 반드시 마련하고 싶다", delta: { H: 2 } },
      { id: "B", label: "10년 내 천천히 준비하고 싶다", delta: { H: 1 } },
      { id: "C", label: "당장은 안정적인 월세도 괜찮다", delta: { H: -1 } },
      { id: "D", label: "자가에 큰 의미를 두지 않는다", delta: { H: -2 } },
    ]
  },
  {
    id: "Q3", axisGroup: "H", prompt: "이사 갈 집, 신축 vs 구축은?",
    options: [
      { id: "A", label: "낡아도 저렴하면 OK", delta: { H: 2 } },
      { id: "B", label: "웬만하면 구축도 상관없다", delta: { H: 1 } },
      { id: "C", label: "가능하면 신축이 좋다", delta: { H: -1, I: 0.5 } },
      { id: "D", label: "신축이라면 조금 비싸도 OK", delta: { H: -2, I: 1 } },
    ]
  },
  {
    id: "Q4", axisGroup: "J", prompt: "이직할 때 가장 중요한 건?",
    options: [
      { id: "A", label: "연봉이 무조건 우선이다", delta: { J: 2 } },
      { id: "B", label: "커리어 성장 가능성이다", delta: { J: 1 } },
      { id: "C", label: "워라밸이 가장 중요하다", delta: { J: -1, E: 0.5 } },
      { id: "D", label: "여유로운 생활이 최우선이다", delta: { J: -2, E: 1 } },
    ]
  },
  {
    id: "Q5", axisGroup: "T", prompt: "원하는 근무 형태는?",
    options: [
      { id: "A", label: "사무실 출근형이 편하다", delta: { T: 2 } },
      { id: "B", label: "하이브리드(재택+출근) 선호", delta: { T: 1 } },
      { id: "C", label: "재택/원격 위주가 좋다", delta: { T: -1 } },
      { id: "D", label: "근무 형태는 상관없다", delta: { T: -2 } },
    ]
  },
  {
    id: "Q6", axisGroup: "J", prompt: "이 지역의 산업 다양성은?",
    options: [
      { id: "A", label: "반드시 다양해야 한다(이직 대비)", delta: { J: 2 } },
      { id: "B", label: "어느 정도는 있어야 한다", delta: { J: 1 } },
      { id: "C", label: "한 우물만 파도 상관없다", delta: { J: -1 } },
      { id: "D", label: "크게 신경 쓰지 않는다", delta: { J: -2 } },
    ]
  },
  {
    id: "Q7", axisGroup: "T", prompt: "평소 이동 수단은?",
    options: [
      { id: "A", label: "대중교통(버스/지하철) 위주다", delta: { T: 2 } },
      { id: "B", label: "대중교통+도보 혼합이다", delta: { T: 1 } },
      { id: "C", label: "주로 자차를 이용한다", delta: { T: -1 } },
      { id: "D", label: "자차 위주라 상관없다", delta: { T: -2 } },
    ]
  },
  {
    id: "Q8", axisGroup: "T", prompt: "서울/광역시 접근성은?",
    options: [
      { id: "A", label: "KTX·고속버스로 1시간 내여야 한다", delta: { T: 2 } },
      { id: "B", label: "2시간 내면 괜찮다", delta: { T: 1 } },
      { id: "C", label: "반나절 정도는 괜찮다", delta: { T: -1 } },
      { id: "D", label: "거리는 크게 상관없다", delta: { T: -2 } },
    ]
  },
  {
    id: "Q9", axisGroup: "I", prompt: "병원/의료시설은?",
    options: [
      { id: "A", label: "대형병원이 꼭 가까워야 안심된다", delta: { I: 2 } },
      { id: "B", label: "종합병원 정도는 있어야 한다", delta: { I: 1 } },
      { id: "C", label: "동네 병원 정도면 충분하다", delta: { I: -1 } },
      { id: "D", label: "웬만하면 상관없다", delta: { I: -2 } },
    ]
  },
  {
    id: "Q10", axisGroup: "I", prompt: "자녀 교육(또는 향후 계획)은?",
    options: [
      { id: "A", label: "학군/학원가가 매우 중요하다", delta: { I: 2 } },
      { id: "B", label: "어느 정도는 신경 쓰인다", delta: { I: 1 } },
      { id: "C", label: "크게 중요하지 않다", delta: { I: -1 } },
      { id: "D", label: "전혀 신경 쓰지 않는다", delta: { I: -2 } },
    ]
  },
  {
    id: "Q11", axisGroup: "I", prompt: "대형마트·편의시설 접근성은?",
    options: [
      { id: "A", label: "걸어서 갈 수 있어야 한다", delta: { I: 2 } },
      { id: "B", label: "차로 10분 이내면 좋다", delta: { I: 1 } },
      { id: "C", label: "차 타고 가도 무방하다", delta: { I: -1 } },
      { id: "D", label: "크게 신경 쓰지 않는다", delta: { I: -2 } },
    ]
  },
  {
    id: "Q12", axisGroup: "E", prompt: "주말을 보내고 싶은 방식은?",
    options: [
      { id: "A", label: "등산·바다 등 자연 속에서", delta: { E: 2 } },
      { id: "B", label: "근교 나들이 정도가 좋다", delta: { E: 1 } },
      { id: "C", label: "도심에서 활동적으로 보내고 싶다", delta: { E: -1, C: 0.5 } },
      { id: "D", label: "집에서 조용히 쉬고 싶다", delta: { E: -2 } },
    ]
  },
  {
    id: "Q13", axisGroup: "E", prompt: "공기질/녹지 환경은?",
    options: [
      { id: "A", label: "최우선 고려사항이다", delta: { E: 2 } },
      { id: "B", label: "어느 정도 신경 쓰인다", delta: { E: 1 } },
      { id: "C", label: "크게 신경 쓰지 않는다", delta: { E: -1 } },
      { id: "D", label: "전혀 상관없다", delta: { E: -2 } },
    ]
  },
  {
    id: "Q14", axisGroup: "C", prompt: "여가 시간에 자주 하는 것은?",
    options: [
      { id: "A", label: "영화관/공연/전시 관람", delta: { C: 2 } },
      { id: "B", label: "카페·맛집 탐방", delta: { C: 1 } },
      { id: "C", label: "야외 활동(등산, 산책 등)", delta: { C: -1, E: 0.5 } },
      { id: "D", label: "집에서 휴식", delta: { C: -2 } },
    ]
  },
  {
    id: "Q15", axisGroup: "C", prompt: "없으면 아쉬운 문화시설은?",
    options: [
      { id: "A", label: "영화관·공연장이 꼭 필요하다", delta: { C: 2 } },
      { id: "B", label: "도서관·문화센터 정도면 된다", delta: { C: 1, I: 0.5 } },
      { id: "C", label: "있으면 좋지만 없어도 무방하다", delta: { C: -1 } },
      { id: "D", label: "크게 중요하지 않다", delta: { C: -2 } },
    ]
  },
];

const ALL_AXES: Axis[] = ["H", "T", "I", "C", "E", "J"];

// ------------------------------------------------------------------
// 2. 사용자 응답 → 벡터화 (14:00~15:00 블록)
// ------------------------------------------------------------------
export type Answers = Record<string, "A" | "B" | "C" | "D">; // { Q1: "A", Q2: "C", ... }

/**
 * 각 축의 이론적 최소/최대 raw score (고정값, 가중치 영향 없음 — 항상 표준 0~100 스케일 유지)
 */
function theoreticalRange(axis: Axis): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const q of QUESTIONS) {
    const deltas = q.options.map((o) => o.delta[axis] ?? 0);
    min += Math.min(...deltas, 0);
    max += Math.max(...deltas, 0);
  }
  return { min, max };
}

/**
 * 15문항 응답을 0~100 정규화된 표준 사용자 벡터로 변환.
 * 가중치는 여기서 적용하지 않는다 — 분자/분모에 동일 가중치를 곱하면 서로 상쇄돼
 * 아무 효과가 없기 때문에 무엇을 더 중요하게 볼지는
 * matchRegions()의 weightedCosine 단계에서만 다룬다.
 */
export function vectorizeAnswers(answers: Answers): Vector {
  const raw: Record<Axis, number> = { H: 0, T: 0, I: 0, C: 0, E: 0, J: 0 };

  for (const q of QUESTIONS) {
    const picked = answers[q.id];
    if (!picked) continue; // 미응답 문항은 스킵
    const opt = q.options.find((o) => o.id === picked);
    if (!opt) continue;
    for (const [axis, val] of Object.entries(opt.delta) as [Axis, number][]) {
      raw[axis] += val;
    }
  }

  const vector = {} as Vector;
  for (const axis of ALL_AXES) {
    const { min, max } = theoreticalRange(axis);
    const range = max - min || 1; // 0 나눗셈 방지
    vector[axis] = Math.max(0, Math.min(100, ((raw[axis] - min) / range) * 100));
  }

  return vector;
}

/**
 * 축별 가중치 배율. 기본값 1.
 * - priorityAxes(사용자가 고른 "포기 못하는 2가지")는 1.5배
 * - hasCar=true면 T(교통)축은 0.3배로 낮춤 (자차 있으면 대중교통 접근성 발언권을 줄임)
 * matchRegions()에 그대로 넘기면 weighted cosine 유사도 계산에 반영된다.
 */
export function buildAxisWeights(
  priorityAxes: Axis[] = [],
  basicInfo?: Pick<BasicInfo, "hasCar">
): Partial<Record<Axis, number>> {
  const w: Partial<Record<Axis, number>> = {};
  for (const axis of priorityAxes) {
    w[axis] = (w[axis] ?? 1) * 1.5;
  }
  if (basicInfo?.hasCar) {
    w.T = (w.T ?? 1) * 0.3;
  }
  return w;
}

// ------------------------------------------------------------------
// 3. Hard Filter (15:00~16:00 블록) — 진짜로 "배제"할 것만 여기서 거른다
// ------------------------------------------------------------------
/**
 * 예산만 진짜 Hard Filter로 처리한다.
 * - hasCar(자차 유무): 지역을 배제하지 않고, buildAxisWeights()에서 T축 가중치를
 *   0.3배로 낮추는 방식으로 매칭 점수에 "약하게" 반영한다 (완전 배제는 과함).
 * - jobField(희망 직무): 매칭 단계에서 지역을 거르는 데 쓰지 않는다.
 *   대신 Top3 매칭 이후 "지역 상세(Connect)" 화면에서 고용24 API를
 *   해당 직무로 필터링해 실시간 채용정보를 보여줄 때 사용한다
 *   
 */
export function hardFilter(
  regions: RegionEntry[],
  basicInfo: Pick<BasicInfo, "budgetMax">
): RegionEntry[] {
  return regions.filter((r) => {
    if (r.budgetProxy != null && r.budgetProxy > basicInfo.budgetMax) {
      return false;
    }
    return true;
  });
}

// ------------------------------------------------------------------
// 4. Cosine 유사도 + Top3 (16:00~17:00 블록)
// ------------------------------------------------------------------
function cosineSimilarity(u: number[], v: number[]): number {
  const dot = u.reduce((s, x, i) => s + x * v[i], 0);
  const normU = Math.sqrt(u.reduce((s, x) => s + x * x, 0));
  const normV = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return dot / (normU * normV + 1e-9);
}

/**
 * 가중 코사인 유사도: 각 축 값에 sqrt(weight)를 곱한 뒤 코사인 유사도를 계산.
 * (weight를 양쪽 벡터에 동일하게 곱해야 "그 축이 유사도에 기여하는 비중"이 커짐 —
 *  분자/분모에 각각 곱하면 상쇄되던 이전 버그와 다른 지점에 적용하는 것이 핵심)
 */
function weightedCosineSimilarity(
  u: number[],
  v: number[],
  weights: number[]
): number {
  const wu = u.map((x, i) => x * Math.sqrt(weights[i]));
  const wv = v.map((x, i) => x * Math.sqrt(weights[i]));
  return cosineSimilarity(wu, wv);
}

/**
 * J축이 지역 데이터에 없는 경우(고용24 배치 전) 자동으로 축을 제외하고 계산.
 * weights: buildAxisWeights()로 만든 축별 가중치. 안 넘기면 전부 1(균등).
 */
export function matchRegions(
  userVector: Vector,
  regions: RegionEntry[],
  options?: { useAxes?: Axis[]; weights?: Partial<Record<Axis, number>>; topN?: number }
): MatchResult[] {
  const topN = options?.topN ?? 3;
  const hasJData = regions.some((r) => r.vector.J != null);
  const axes: Axis[] =
    options?.useAxes ?? (hasJData ? ALL_AXES : ALL_AXES.filter((a) => a !== "J"));
  const weights = axes.map((a) => options?.weights?.[a] ?? 1);

  const u = axes.map((a) => userVector[a] ?? 0);

  const scored = regions.map((r) => {
    const v = axes.map((a) => r.vector[a] ?? 0);
    return {
      region: r.region,
      similarity: weightedCosineSimilarity(u, v, weights),
      vector: r.vector,
    };
  });

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
}

// ------------------------------------------------------------------
// 5. 통합 API (17:00~18:00 블록) — 프론트에서 이거 하나만 호출하면 됨
// ------------------------------------------------------------------
export interface RecommendInput {
  answers: Answers;
  priorityAxes?: Axis[]; // 사용자가 고른 "포기 못하는 2가지" (16번째 문항)
  basicInfo: BasicInfo;
  regions: RegionEntry[];
  topN?: number;
}

export interface RecommendOutput {
  userVector: Vector;
  weightsUsed: Partial<Record<Axis, number>>;
  filteredRegionCount: number;
  results: MatchResult[];
}

/**
 * 진단 응답부터 Top3 지역 추천까지 한 번에 처리하는 단일 진입점.
 * 프론트(개발3)는 이 함수 하나만 호출하면 됨.
 */
export function recommend(input: RecommendInput): RecommendOutput {
  const userVector = vectorizeAnswers(input.answers);
  const weights = buildAxisWeights(input.priorityAxes ?? [], input.basicInfo);
  const filtered = hardFilter(input.regions, input.basicInfo);
  const results = matchRegions(userVector, filtered, {
    weights,
    topN: input.topN ?? 3,
  });

  return {
    userVector,
    weightsUsed: weights,
    filteredRegionCount: filtered.length,
    results,
  };
}
/*
import regionData from "./region_vectors.json"; // 개발2 산출물

const answers: Answers = { Q1: "A", Q2: "B", Q3: "A", Q4: "C", Q5: "D",
  Q6: "B", Q7: "A", Q8: "C", Q9: "C", Q10: "D", Q11: "C",
  Q12: "A", Q13: "A", Q14: "C", Q15: "B" };

const basicInfo: BasicInfo = {
  ageGroup: "20대", jobField: "IT", budgetMax: 60, hasCar: false,
};

const userVector = vectorizeAnswers(answers);       // 항상 표준 0~100, 가중치 영향 없음
const weights = buildAxisWeights(["H", "E"], basicInfo); // 우선순위 2축 + 자차여부 → 매칭 가중치

const regions: RegionEntry[] = regionData.map((d: any) => ({
  region: d.region,
  vector: d.vector,
}));

const filtered = hardFilter(regions, basicInfo); // 예산만 거름
const top3 = matchRegions(userVector, filtered, { weights });
console.log(top3);
*/


