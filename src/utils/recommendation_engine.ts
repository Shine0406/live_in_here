/**
 * 여기살래? — 추천 엔진 (개발1 담당)
 * 13:00~17:00 블록: 알고리즘 설계 / 15문항 벡터화 / Hard Filter / Cosine Top3
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
  ageGroup: string; // "20대" | "30대" ...
  jobField: string; // 희망 직무 대분류
  budgetMax: number; // 월 주거비 예산 상한 (만원)
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
  budgetProxy?: number; // Hard Filter용 주거비 실측치(만원). 없으면 H축 역산 사용
  jobCategories?: string[]; // 이 지역에 채용이 "있는" 직종카테고리 목록 (job_categories_by_region.csv에서 옴)
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
  { id: "Q1", axisGroup: "H", prompt: "주거비, 나에게 더 중요한 건?",
    options: [
      { id: "A", label: "무조건 저렴한 게 최고다", delta: { H: 2 } },
      { id: "B", label: "낡아도 저렴하면 괜찮다", delta: { H: 1 } },
      { id: "C", label: "조금 비싸도 신축이 좋다", delta: { H: -1 } },
      { id: "D", label: "넓고 쾌적한 공간이 우선이다", delta: { H: -2, I: 1 } },
    ] },
  { id: "Q2", axisGroup: "H", prompt: "내 집 마련 계획은?",
    options: [
      { id: "A", label: "5년 내 반드시 마련하고 싶다", delta: { H: 2 } },
      { id: "B", label: "10년 내 천천히 준비하고 싶다", delta: { H: 1 } },
      { id: "C", label: "당장은 안정적인 월세도 괜찮다", delta: { H: -1 } },
      { id: "D", label: "자가에 큰 의미를 두지 않는다", delta: { H: -2 } },
    ] },
  { id: "Q3", axisGroup: "H", prompt: "이사 갈 집, 신축 vs 구축은?",
    options: [
      { id: "A", label: "낡아도 저렴하면 OK", delta: { H: 2 } },
      { id: "B", label: "웬만하면 구축도 상관없다", delta: { H: 1 } },
      { id: "C", label: "가능하면 신축이 좋다", delta: { H: -1, I: 0.5 } },
      { id: "D", label: "신축이라면 조금 비싸도 OK", delta: { H: -2, I: 1 } },
    ] },
  { id: "Q4", axisGroup: "J", prompt: "이직할 때 가장 중요한 건?",
    options: [
      { id: "A", label: "연봉이 무조건 우선이다", delta: { J: 2 } },
      { id: "B", label: "커리어 성장 가능성이다", delta: { J: 1 } },
      { id: "C", label: "워라밸이 가장 중요하다", delta: { J: -1, E: 0.5 } },
      { id: "D", label: "여유로운 생활이 최우선이다", delta: { J: -2, E: 1 } },
    ] },
  { id: "Q5", axisGroup: "T", prompt: "원하는 근무 형태는?",
    options: [
      { id: "A", label: "사무실 출근형이 편하다", delta: { T: 2 } },
      { id: "B", label: "하이브리드(재택+출근) 선호", delta: { T: 1 } },
      { id: "C", label: "재택/원격 위주가 좋다", delta: { T: -1 } },
      { id: "D", label: "근무 형태는 상관없다", delta: { T: -2 } },
    ] },
  { id: "Q6", axisGroup: "J", prompt: "이 지역의 산업 다양성은?",
    options: [
      { id: "A", label: "반드시 다양해야 한다(이직 대비)", delta: { J: 2 } },
      { id: "B", label: "어느 정도는 있어야 한다", delta: { J: 1 } },
      { id: "C", label: "한 우물만 파도 상관없다", delta: { J: -1 } },
      { id: "D", label: "크게 신경 쓰지 않는다", delta: { J: -2 } },
    ] },
  { id: "Q7", axisGroup: "T", prompt: "평소 이동 수단은?",
    options: [
      { id: "A", label: "대중교통(버스/지하철) 위주다", delta: { T: 2 } },
      { id: "B", label: "대중교통+도보 혼합이다", delta: { T: 1 } },
      { id: "C", label: "주로 자차를 이용한다", delta: { T: -1 } },
      { id: "D", label: "자차 위주라 상관없다", delta: { T: -2 } },
    ] },
  { id: "Q8", axisGroup: "T", prompt: "서울/광역시 접근성은?",
    options: [
      { id: "A", label: "KTX·고속버스로 1시간 내여야 한다", delta: { T: 2 } },
      { id: "B", label: "2시간 내면 괜찮다", delta: { T: 1 } },
      { id: "C", label: "반나절 정도는 괜찮다", delta: { T: -1 } },
      { id: "D", label: "거리는 크게 상관없다", delta: { T: -2 } },
    ] },
  { id: "Q9", axisGroup: "I", prompt: "병원/의료시설은?",
    options: [
      { id: "A", label: "대형병원이 꼭 가까워야 안심된다", delta: { I: 2 } },
      { id: "B", label: "종합병원 정도는 있어야 한다", delta: { I: 1 } },
      { id: "C", label: "동네 병원 정도면 충분하다", delta: { I: -1 } },
      { id: "D", label: "웬만하면 상관없다", delta: { I: -2 } },
    ] },
  { id: "Q10", axisGroup: "I", prompt: "자녀 교육(또는 향후 계획)은?",
    options: [
      { id: "A", label: "학군/학원가가 매우 중요하다", delta: { I: 2 } },
      { id: "B", label: "어느 정도는 신경 쓰인다", delta: { I: 1 } },
      { id: "C", label: "크게 중요하지 않다", delta: { I: -1 } },
      { id: "D", label: "전혀 신경 쓰지 않는다", delta: { I: -2 } },
    ] },
  { id: "Q11", axisGroup: "I", prompt: "대형마트·편의시설 접근성은?",
    options: [
      { id: "A", label: "걸어서 갈 수 있어야 한다", delta: { I: 2 } },
      { id: "B", label: "차로 10분 이내면 좋다", delta: { I: 1 } },
      { id: "C", label: "차 타고 가도 무방하다", delta: { I: -1 } },
      { id: "D", label: "크게 신경 쓰지 않는다", delta: { I: -2 } },
    ] },
  { id: "Q12", axisGroup: "E", prompt: "주말을 보내고 싶은 방식은?",
    options: [
      { id: "A", label: "등산·바다 등 자연 속에서", delta: { E: 2 } },
      { id: "B", label: "근교 나들이 정도가 좋다", delta: { E: 1 } },
      { id: "C", label: "도심에서 활동적으로 보내고 싶다", delta: { E: -1, C: 0.5 } },
      { id: "D", label: "집에서 조용히 쉬고 싶다", delta: { E: -2 } },
    ] },
  { id: "Q13", axisGroup: "E", prompt: "공기질/녹지 환경은?",
    options: [
      { id: "A", label: "최우선 고려사항이다", delta: { E: 2 } },
      { id: "B", label: "어느 정도 신경 쓰인다", delta: { E: 1 } },
      { id: "C", label: "크게 신경 쓰지 않는다", delta: { E: -1 } },
      { id: "D", label: "전혀 상관없다", delta: { E: -2 } },
    ] },
  { id: "Q14", axisGroup: "C", prompt: "여가 시간에 자주 하는 것은?",
    options: [
      { id: "A", label: "영화관/공연/전시 관람", delta: { C: 2 } },
      { id: "B", label: "카페·맛집 탐방", delta: { C: 1 } },
      { id: "C", label: "야외 활동(등산, 산책 등)", delta: { C: -1, E: 0.5 } },
      { id: "D", label: "집에서 휴식", delta: { C: -2 } },
    ] },
  { id: "Q15", axisGroup: "C", prompt: "없으면 아쉬운 문화시설은?",
    options: [
      { id: "A", label: "영화관·공연장이 꼭 필요하다", delta: { C: 2 } },
      { id: "B", label: "도서관·문화센터 정도면 된다", delta: { C: 1, I: 0.5 } },
      { id: "C", label: "있으면 좋지만 없어도 무방하다", delta: { C: -1 } },
      { id: "D", label: "크게 중요하지 않다", delta: { C: -2 } },
    ] },
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
 * 아무 효과가 없기 때문에(버그였음), "무엇을 더 중요하게 볼지"는
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
 * - budgetMax: 예산 초과 지역은 진짜로 배제
 * - jobField: RegionEntry.jobCategories에 해당 직무가 아예 없는(채용 0건) 지역만 배제.
 *   "있으면 좋고 없어도 그만" 수준(적어서 점수만 낮은 경우)이 아니라
 *   "정말 하나도 없음"만 걸러내는 최소한의 안전장치로 쓴다.
 *   region.jobCategories가 아예 없는 경우(배치 전 등)는 판단 불가이므로 통과시킨다.
 * - hasCar: 여기서 필터링하지 않는다. buildAxisWeights()에서 T축 가중치로만 반영.
 */
export function hardFilter(
  regions: RegionEntry[],
  basicInfo: Pick<BasicInfo, "budgetMax" | "jobField">
): RegionEntry[] {
  return regions.filter((r) => {
    if (r.budgetProxy != null && r.budgetProxy > basicInfo.budgetMax) {
      return false;
    }
    if (
      basicInfo.jobField &&
      r.jobCategories != null &&
      !r.jobCategories.includes(basicInfo.jobField)
    ) {
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

// ------------------------------------------------------------------
// 6. LLM 리포트용 입력 데이터 구조화 (21:00~22:00 블록)
// ------------------------------------------------------------------
export const AXIS_LABELS: Record<Axis, string> = {
  H: "주거비",
  T: "교통",
  I: "생활 인프라",
  C: "문화 향유",
  E: "자연환경",
  J: "일자리",
};

export interface AxisGap {
  axis: Axis;
  label: string;
  userScore: number;   // 0~100, 사용자가 원한 정도
  regionScore: number; // 0~100, 그 지역의 실제 점수
  gap: number;          // regionScore - userScore (양수=지역이 기대보다 좋음, 음수=기대에 못 미침)
}

export interface RegionReportInput {
  region: string;
  similarityPercent: number; // 0~100
  strengths: AxisGap[];      // 사용자 기대에 가장 잘 부합한 축 2개 (gap의 절대값이 작은 순)
  considerations: AxisGap[]; // 사용자 기대와 가장 차이 나는 축 2개 (지역이 기대에 못 미치는 축 우선)
}

function computeAxisGaps(userVector: Vector, regionVector: Vector): AxisGap[] {
  return ALL_AXES.map((axis) => ({
    axis,
    label: AXIS_LABELS[axis],
    userScore: Math.round(userVector[axis] ?? 0),
    regionScore: Math.round(regionVector[axis] ?? 0),
    gap: Math.round((regionVector[axis] ?? 0) - (userVector[axis] ?? 0)),
  }));
}

/**
 * recommend()의 결과를 LLM 프롬프트에 바로 넣을 수 있는 구조로 변환.
 * - strengths: 사용자가 원한 것과 지역 실제 점수가 가장 가까운 2축 ("이래서 잘 맞아요")
 * - considerations: 사용자 기대보다 지역 점수가 낮은 축 중 가장 부족한 2개 ("이 부분은 참고하세요")
 *   → 지역이 기대보다 훨씬 좋은 경우(gap이 양수)는 considerations에 넣지 않는다.
 *     "고려할 점"은 부족한 부분을 말하는 것이지 넘치는 부분이 아니기 때문.
 *
 * @param excludeAxes 리포트 근거로 안 쓸 축. 기본값 ["J"] —
 *   J(일자리)는 고용24 API 미연동으로 T/I축 기반 합성값이라, "일자리가 완벽히 맞아요" 같은
 *   문구가 실제 채용 데이터처럼 오해되는 걸 막기 위해 기본적으로 리포트 근거에서 제외한다.
 *   실제 채용 데이터 연동되면 두 번째 인자를 []로 바꿔서 켜면 됨.
 */
export function buildReportInputs(
  output: RecommendOutput,
  excludeAxes: Axis[] = ["J"]
): RegionReportInput[] {
  return output.results.map((result) => {
    const gaps = computeAxisGaps(output.userVector, result.vector).filter(
      (g) => !excludeAxes.includes(g.axis)
    );

    const strengths = [...gaps]
      .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
      .slice(0, 2);

    const considerations = [...gaps]
      .filter((g) => g.gap < 0) // 지역이 기대에 못 미치는 축만
      .sort((a, b) => a.gap - b.gap) // 가장 많이 부족한 순
      .slice(0, 2);

    return {
      region: result.region,
      similarityPercent: Math.round(result.similarity * 100),
      strengths,
      considerations,
    };
  });
}

/**
 * 개발2가 LLM API에 그대로 넘길 프롬프트 문자열 생성.
 * 실제 API 호출(fetch 등)은 개발2 담당 — 여기선 "무엇을 프롬프트에 넣을지"만 정리.
 * (기획팀 Prompt V1/V2 설계 시 이 함수의 프롬프트 문구를 베이스로 다듬으면 됨)
 */
export function buildLLMPrompt(reportInput: RegionReportInput): string {
  const strengthsText = reportInput.strengths
    .map((s) => `- ${s.label}: 원한 정도 ${s.userScore}점, 이 지역 ${s.regionScore}점 (거의 일치)`)
    .join("\n");
  const considerationsText = reportInput.considerations.length
    ? reportInput.considerations
        .map((c) => `- ${c.label}: 원한 정도 ${c.userScore}점, 이 지역 ${c.regionScore}점 (부족)`)
        .join("\n")
    : "특별히 부족한 축 없음";

  return `당신은 지역 정착 추천 서비스 "여기살래?"의 리포트 작성자입니다.
아래 정보를 바탕으로, 사용자에게 "${reportInput.region}"을(를) 추천하는 이유와 고려할 점을
각각 2~3문장으로, 친근하고 담백한 말투로 작성해주세요. 과장하지 말고 사실 기반으로 쓰세요.

[적합도] ${reportInput.similarityPercent}%

[가장 잘 맞는 부분]
${strengthsText}

[고려할 점]
${considerationsText}

출력 형식(JSON만, 다른 텍스트 없이):
{"title": "한 줄 요약", "reason": "추천 이유 문단", "consideration": "고려사항 문단"}`;
}

/**
 * "자세히 알아보기" 탭 전체를 한 번에 생성하는 프롬프트.
 * 16personalities의 "자세히 알아보기" 탭처럼, Top1은 길게 풀어서 서술하고
 * Top2/3는 비교 관점에서 짧게, 마지막에 정책 안내 자리를 남겨둔다.
 *
 * @param reportInputs buildReportInputs()의 결과 (Top3 전부)
 * @param policyHint (선택) 지역별 청년정책 요약. 정책 API 연동 전이면 비워두면 됨 —
 *   비어있으면 LLM이 "정책은 별도 확인 필요"로 마무리하도록 프롬프트에 안내해둠.
 */
export function buildDetailReportPrompt(
  reportInputs: RegionReportInput[],
  policyHint?: Partial<Record<string, string>>
): string {
  const [top1, ...runnerUps] = reportInputs;
  if (!top1) return "";

  const top1Strengths = top1.strengths
    .map((s) => `- ${s.label}: 원한 정도 ${s.userScore}점, 이 지역 ${s.regionScore}점`)
    .join("\n");
  const top1Considerations = top1.considerations.length
    ? top1.considerations
        .map((c) => `- ${c.label}: 원한 정도 ${c.userScore}점, 이 지역 ${c.regionScore}점 (부족)`)
        .join("\n")
    : "특별히 부족한 축 없음";

  const runnerUpsText = runnerUps
    .map((r, i) => {
      const topGap = r.strengths[0];
      const mainGap = r.considerations[0];
      return `${i + 2}위: ${r.region} (적합도 ${r.similarityPercent}%)
  - 잘 맞는 부분: ${topGap ? `${topGap.label} (${topGap.regionScore}점)` : "없음"}
  - 아쉬운 부분: ${mainGap ? `${mainGap.label} (${mainGap.regionScore}점, 원한 건 ${mainGap.userScore}점)` : "없음"}`;
    })
    .join("\n\n");

  const policyText = policyHint?.[top1.region]
    ? policyHint[top1.region]
    : "관련 청년정책 데이터는 아직 연동 전입니다. 이 자리는 정책 API 연동 후 채워주세요.";

  return `당신은 지역 정착 추천 서비스 "여기살래?"의 리포트 작성자입니다.
아래 데이터를 바탕으로, 진단 결과 화면의 "자세히 알아보기" 탭에 들어갈 글을 작성해주세요.
사람이 직접 쓴 것처럼 자연스럽게, 문단을 나눠서, 과장 없이 사실 기반으로 써주세요.
전체 500~700자 내외.

[1위: ${top1.region}, 적합도 ${top1.similarityPercent}%]
잘 맞는 부분:
${top1Strengths}
고려할 점:
${top1Considerations}

[2~3위 비교]
${runnerUpsText}

[관련 정책 정보]
${policyText}

작성 순서:
1. 헤드라인: "당신에게는 ○○이(가) 잘 맞아요" 느낌의 한 줄
2. 1위 지역을 왜 추천하는지 3~4문장으로 자연스럽게 풀어서 서술 (강점과 고려할 점 모두 자연스럽게 녹여서)
3. 2위, 3위는 "1위만큼은 아니지만 이런 분들께 더 맞을 수 있어요" 식으로 1~2문장씩 짧게
4. 관련 정책 정보를 1~2문장으로 안내 (정책 데이터 없으면 그 사실을 자연스럽게 언급)

출력 형식(JSON만, 다른 텍스트 없이):
{
  "headline": "한 줄 헤드라인",
  "topRegionDetail": "1위 지역 상세 서술 문단",
  "runnerUps": [
    {"region": "2위 지역명", "blurb": "1~2문장 비교"},
    {"region": "3위 지역명", "blurb": "1~2문장 비교"}
  ],
  "policyNote": "정책 안내 1~2문장"
}`;
}

/**
 * 마스코트 카테고리 결정 (LLM 아님, 순수 계산).
 * 229개 지역마다 그림을 따로 준비할 수 없으니, 지역 벡터에서 가장 두드러진 축으로
 * 몇 가지 마스코트 유형 중 하나를 고른다. 디자인팀이 이 카테고리별로 일러스트 하나씩만
 * 준비하면 됨 (지역별 아님, 유형별).
 */
export type MascotType = "nature" | "culture" | "urban" | "transit" | "budget" | "balanced";

export const MASCOT_LABELS: Record<MascotType, string> = {
  nature: "자연친화형",
  culture: "문화향유형",
  urban: "인프라중심형",
  transit: "교통편의형",
  budget: "가성비형",
  balanced: "균형형",
};

/**
 * 지역 벡터에서 가장 높은 축을 기준으로 마스코트 유형 결정.
 * 1등과 2등 차이가 10점 미만으로 근소하면 "balanced"로 처리.
 */
export function getMascotType(regionVector: Vector): MascotType {
  const axisToMascot: Partial<Record<Axis, MascotType>> = {
    E: "nature",
    C: "culture",
    I: "urban",
    T: "transit",
    H: "budget",
  };

  const scored = ALL_AXES
    .filter((a) => a !== "J") // J는 아직 합성값이라 마스코트 결정에서 제외
    .map((axis) => ({ axis, score: regionVector[axis] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const [top, second] = scored;
  if (!top) return "balanced";
  if (second && top.score - second.score < 10) return "balanced";

  return axisToMascot[top.axis] ?? "balanced";
}

export interface ResultPageContent {
  soulRegionLine: string;   // "당신의 soul 지역은 목포시입니다!"
  typeSummary: string;      // "저렴한 주거비를 중요하게 생각하는 당신에게 적합합니다." (카드 앞면, 버튼 누르기 전)
  detailedReason: string;   // "자세히 알아보기" 탭: LLM이 쓴 장문 매칭 이유
  runnerUps: { region: string; blurb: string }[]; // "자세히 알아보기" 탭: 2위, 3위
  policyNote: string;       // "자세히 알아보기" 탭: 맞춤 정책 안내
}

/**
 * 결과 화면 전체 생성 프롬프트. 16personalities 구조를 그대로 따른다:
 *   [카드 앞면 — 항상 보임] soulRegionLine + 마스코트(getMascotType, 별도 처리) + typeSummary + "자세히 알아보기" 버튼
 *   [정착 성향 그래프 — 항상 보임, 기존 막대그래프]
 *   [자세히 알아보기 탭 — 버튼 눌러야 펼쳐짐] detailedReason + runnerUps + policyNote
 */
/**
 * 사용자가 실제로 고른 선택지 라벨들을 뽑아옴. "MBTI가 와닿는 이유"는 점수가 아니라
 * "당신은 이럴 때 이렇게 하죠?" 같은 구체적 행동 묘사에서 나오므로, 점수뿐 아니라
 * 실제 답변 문구를 LLM에게 재료로 준다.
 */
function getAnsweredLabels(answers: Answers): string[] {
  return QUESTIONS.map((q) => {
    const picked = answers[q.id];
    if (!picked) return null;
    const opt = q.options.find((o) => o.id === picked);
    return opt ? `"${q.prompt}" → "${opt.label}"` : null;
  }).filter((x): x is string => x !== null);
}

export function buildResultPagePrompt(
  answers: Answers,
  reportInputs: RegionReportInput[],
  policyHint?: Partial<Record<string, string>>
): string {
  const [top1, ...runnerUps] = reportInputs;
  if (!top1) return "";

  const answeredLabels = getAnsweredLabels(answers).join("\n");

  const top1Strengths = top1.strengths
    .map((s) => `- ${s.label}: 원한 정도 ${s.userScore}점, 이 지역 ${s.regionScore}점`)
    .join("\n");
  const top1Considerations = top1.considerations.length
    ? top1.considerations
        .map((c) => `- ${c.label}: 원한 정도 ${c.userScore}점, 이 지역 ${c.regionScore}점 (부족)`)
        .join("\n")
    : "특별히 부족한 축 없음";

  const runnerUpsText = runnerUps
    .map((r, i) => {
      const topGap = r.strengths[0];
      return `${i + 2}위: ${r.region} (적합도 ${r.similarityPercent}%) — 특히 ${topGap ? `${topGap.label}(${topGap.regionScore}점)` : "여러 조건"}이 괜찮은 편`;
    })
    .join("\n");

  const policyText = policyHint?.[top1.region] ?? "정책 데이터 연동 전";

  return `당신은 지역 정착 추천 서비스 "여기살래?"의 리포트 작성자입니다.
목표는 MBTI 결과를 읽을 때 느끼는 "와 이거 완전 내 얘기잖아" 하는 몰입감과 확신을 재현하는 것입니다.
그러려면 점수만 나열하지 말고, 사용자가 실제로 고른 답변(아래 [사용자가 고른 답변들])의 뉘앙스를
직접 인용하듯 촘촘하게 녹여서, "당신은 ~하는 편이시죠", "~보다는 ~를 택하시는 분" 같은 식으로
그 사람의 생활 방식을 그려주듯 써주세요. 점수는 근거로만 쓰고 전면에 내세우지 마세요.
과장하거나 근거 없는 내용을 지어내지 말고, 아래 데이터에서만 끌어오세요.
글 길이는 넉넉해도 됩니다 — 짧게 요약하기보다 구체적으로 풀어써주세요.

톤은 전체적으로 확신에 차고 긍정적이어야 합니다. 1위 지역 이야기는 특히 "당신이 고른 답변들이
이 지역과 이렇게 잘 맞아떨어진다"는 걸 계속 짚어주면서 자신감 있게 풀어주세요 — 사용자가 읽으면서
"내가 원한 게 정확히 여기 있네"라고 느끼게 하는 게 목적입니다. 부족한 부분(고려할 점)을 언급할 때도
경고나 단점처럼 쓰지 말고, "이 정도는 감안해도 좋을 만큼 다른 게 좋다" 또는 "이 부분만 살짝 열어두면
더 완벽해질 거예요" 같은, 여전히 응원하는 어조로 가볍게만 짚고 넘어가세요. 사실을 왜곡하진 말되,
무게 중심은 항상 "왜 이 지역이 좋은 선택인지"에 있어야 합니다.

[사용자가 고른 답변들 — 15문항 전체]
${answeredLabels}

[1위: ${top1.region}, 적합도 ${top1.similarityPercent}%]
잘 맞는 부분:
${top1Strengths}
고려할 점(비중 작게, 긍정적 어조로만):
${top1Considerations}

[2~3위]
${runnerUpsText}

[관련 정책 정보]
${policyText}

작성 지침 (화면 구조상 카드 앞면 vs "자세히 알아보기" 탭으로 나뉨을 염두에 두고 작성):
- soulRegionLine: 카드 앞면. "당신의 soul 지역은 ○○입니다!" 형식 그대로, 지역명만 채워서
- typeSummary: 카드 앞면. MBTI 결과 첫 문장처럼, 사용자의 답변 패턴을 한 번에 요약하는
  임팩트 있고 긍정적인 한 문장 (60자 내외). 예시 톤: "돈 걱정 없이 발 뻗고 자는 게 최우선인 당신"
- detailedReason: "자세히 알아보기" 탭 진입 시 보임. 분량 제한 없음. 최소 3개 이상의 서로 다른
  실제 답변 문구를 구체적으로 인용해가며(예: "출퇴근보다 조용한 저녁을 택하신 걸 보면",
  "자연 속 산책을 고르신 걸 보니") 왜 이 지역이 그 삶의 방식과 정확히 맞아떨어지는지
  몇 문단에 걸쳐 자신감 있게, 긍정적으로 풀어써주세요. 고려할 점은 마지막에 짧게, 응원하는
  어조로만 살짝 곁들이세요 (전체 분량의 15% 이내).
- runnerUps: "자세히 알아보기" 탭. 2위/3위 각각 2~3문장. 이 지역들도 충분히 매력적이라는 걸
  먼저 짚어준 다음, 1위와 비교했을 때 사용자 답변 기준으로 왜 미세하게 밀렸는지 설명
  (예: "이 지역도 주거비는 훌륭해요. 다만 자연을 중요하게 보신 것치고는 1위만큼 완벽하진 않아요")
- policyNote: "자세히 알아보기" 탭 맨 아래. 관련 정책을 1~2문장으로 안내. 정책 데이터 없으면 그 사실을 자연스럽게 언급.

출력 형식(JSON만, 다른 텍스트 없이):
{
  "soulRegionLine": "당신의 soul 지역은 ○○입니다!",
  "typeSummary": "...",
  "detailedReason": "...",
  "runnerUps": [
    {"region": "2위 지역명", "blurb": "..."},
    {"region": "3위 지역명", "blurb": "..."}
  ],
  "policyNote": "..."
}`;
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

// LLM 리포트 입력 예시
const recommendResult = recommend({ answers, basicInfo, regions, priorityAxes: ["H", "E"] });
const reportInputs = buildReportInputs(recommendResult);
reportInputs.forEach((ri) => console.log(buildLLMPrompt(ri)));
*/
