// 동사 사냥꾼 — 데이터.
// 설계 근거(리서치): 동사 자체가 수집 카드가 된다. 문법 체계(족)가 곧 도감 분류라서
// 수집이 그대로 문법 학습이 된다. be동사족을 "유령족"으로 부르는 이유 —
// 이 학생의 진단 결과가 정확히 "be동사가 눈에 안 보인다"였다. 세계관이 오개념을 이름 붙여준다.

// ── 도감 카드 (25종) ─────────────────────────────────────────
// family: 도감 분류이자 문법 범주. star 는 저장에, 여기는 불변 정보만.
export const VERBS = [
  // 유령족 (be동사) — 보이지 않는 동사들
  { lemma: 'am',   family: 'be', emoji: '👻', ko: '~이다 (나)',        forms: ['am'] },
  { lemma: 'is',   family: 'be', emoji: '👻', ko: '~이다 (한 명)',     forms: ['is'] },
  { lemma: 'are',  family: 'be', emoji: '👻', ko: '~이다 (여럿/너)',   forms: ['are'] },
  { lemma: 'was',  family: 'be', emoji: '🌫️', ko: '~였다 (한 명)',     forms: ['was'] },
  { lemma: 'were', family: 'be', emoji: '🌫️', ko: '~였다 (여럿/너)',   forms: ['were'] },
  // 일반동사족 — 움직임이 보이는 동사들
  { lemma: 'like',  family: 'act', emoji: '💖', ko: '좋아하다',   forms: ['like', 'likes'] },
  { lemma: 'read',  family: 'act', emoji: '📖', ko: '읽다',       forms: ['read', 'reads'] },
  { lemma: 'play',  family: 'act', emoji: '⚽', ko: '(놀이를) 하다', forms: ['play', 'plays'] },
  { lemma: 'run',   family: 'act', emoji: '🐆', ko: '달리다',     forms: ['run', 'runs'] },
  { lemma: 'eat',   family: 'act', emoji: '🍔', ko: '먹다',       forms: ['eat', 'eats'] },
  { lemma: 'sleep', family: 'act', emoji: '😴', ko: '자다',       forms: ['sleep', 'sleeps'] },
  { lemma: 'make',  family: 'act', emoji: '🍰', ko: '만들다',     forms: ['make', 'makes', 'made'] },
  { lemma: 'go',    family: 'act', emoji: '🚀', ko: '가다',       forms: ['go', 'goes'] },
  { lemma: 'sing',  family: 'act', emoji: '🎤', ko: '노래하다',   forms: ['sing', 'sings'] },
  { lemma: 'watch', family: 'act', emoji: '📺', ko: '보다',       forms: ['watch', 'watches'] },
  { lemma: 'drink', family: 'act', emoji: '🥛', ko: '마시다',     forms: ['drink', 'drinks'] },
  { lemma: 'know',  family: 'act', emoji: '🧠', ko: '알다',       forms: ['know', 'knows'] },
  { lemma: 'live',  family: 'act', emoji: '🏠', ko: '살다',       forms: ['live', 'lives'] },
  { lemma: 'draw',  family: 'act', emoji: '🖍️', ko: '그리다',     forms: ['draw', 'draws'] },
  { lemma: 'cry',   family: 'act', emoji: '😭', ko: '울다',       forms: ['cry', 'cries'] },
  { lemma: 'love',  family: 'act', emoji: '💘', ko: '사랑하다',   forms: ['love', 'loves'] },
  { lemma: 'open',  family: 'act', emoji: '🚪', ko: '열다',       forms: ['open', 'opens'] },
  { lemma: 'want',  family: 'act', emoji: '⭐', ko: '원하다',     forms: ['want', 'wants'] },
  { lemma: 'cook',  family: 'act', emoji: '🍳', ko: '요리하다',   forms: ['cook', 'cooks'] },
  { lemma: 'kick',  family: 'act', emoji: '🥾', ko: '(발로) 차다', forms: ['kick', 'kicks'] },
];

export const VERB_BY_LEMMA = new Map(VERBS.map((v) => [v.lemma, v]));
export const FAMILY_NAME = { be: '유령족 (be동사)', act: '일반동사족' };

/** 단어(활용형 포함) → 도감 lemma. 못 찾으면 null */
export function lemmaOfWord(word) {
  const w = word.replace(/[.!?]$/, '').toLowerCase();
  for (const v of VERBS) if (v.forms.includes(w)) return v.lemma;
  return null;
}

// ── 문장 풀 ──────────────────────────────────────────────────
// w: 단어 배열 · v: 동사 위치(0부터) · k: 한국어 뜻(뜻 보기용) · be: be동사 문장
// 주어는 항상 0 ~ v-1 — 주어 사냥 모드가 이 규칙 하나로 성립한다.
// 쉬운 단어만: 재는 건 '위치 감각'이라 단어가 방해하면 안 된다 (진단 설계와 동일 원칙).
export const GENERAL = [
  { w: ['I', 'like', 'pizza.'], v: 1, k: '나는 피자를 좋아해.' },
  { w: ['She', 'reads', 'books.'], v: 1, k: '그녀는 책을 읽어.' },
  { w: ['They', 'play', 'soccer.'], v: 1, k: '그들은 축구를 해.' },
  { w: ['The', 'dog', 'runs', 'fast.'], v: 2, k: '그 개는 빨리 달려.' },
  { w: ['We', 'eat', 'lunch.'], v: 1, k: '우리는 점심을 먹어.' },
  { w: ['He', 'sleeps', 'late.'], v: 1, k: '그는 늦게 자.' },
  { w: ['My', 'brother', 'likes', 'games.'], v: 2, k: '내 남동생은 게임을 좋아해.' },
  { w: ['She', 'made', 'a', 'cake.'], v: 1, k: '그녀는 케이크를 만들었어.' },
  { w: ['I', 'go', 'to', 'school.'], v: 1, k: '나는 학교에 가.' },
  { w: ['Birds', 'sing', 'songs.'], v: 1, k: '새들은 노래를 불러.' },
  { w: ['We', 'watch', 'TV.'], v: 1, k: '우리는 TV를 봐.' },
  { w: ['He', 'drinks', 'milk.'], v: 1, k: '그는 우유를 마셔.' },
  { w: ['I', 'know', 'him.'], v: 1, k: '나는 그를 알아.' },
  { w: ['She', 'sings', 'well.'], v: 1, k: '그녀는 노래를 잘해.' },
  { w: ['They', 'live', 'here.'], v: 1, k: '그들은 여기 살아.' },
  { w: ['My', 'sister', 'draws', 'cats.'], v: 2, k: '내 여동생은 고양이를 그려.' },
  { w: ['The', 'baby', 'cries', 'loudly.'], v: 2, k: '그 아기는 크게 울어.' },
  { w: ['We', 'love', 'pizza.'], v: 1, k: '우리는 피자를 정말 좋아해.' },
  { w: ['He', 'opens', 'the', 'door.'], v: 1, k: '그는 문을 열어.' },
  { w: ['I', 'want', 'ice', 'cream.'], v: 1, k: '나는 아이스크림을 원해.' },
  { w: ['My', 'mom', 'cooks', 'dinner.'], v: 2, k: '우리 엄마는 저녁을 요리해.' },
  { w: ['The', 'boy', 'kicks', 'the', 'ball.'], v: 2, k: '그 남자애는 공을 차.' },
  { w: ['Her', 'sister', 'watches', 'movies.'], v: 2, k: '그녀의 언니는 영화를 봐.' },
  { w: ['The', 'kids', 'play', 'games.'], v: 2, k: '그 아이들은 게임을 해.' },
  { w: ['My', 'dog', 'likes', 'snacks.'], v: 2, k: '내 강아지는 간식을 좋아해.' },
  { w: ['The', 'girl', 'sings', 'songs.'], v: 2, k: '그 여자애는 노래를 불러.' },
];

export const BE = [
  { w: ['The', 'cat', 'is', 'small.'], v: 2, be: true, k: '그 고양이는 작아.' },
  { w: ['My', 'friends', 'are', 'happy.'], v: 2, be: true, k: '내 친구들은 행복해.' },
  { w: ['The', 'game', 'was', 'fun.'], v: 2, be: true, k: '그 게임은 재미있었어.' },
  { w: ['I', 'am', 'hungry.'], v: 1, be: true, k: '나는 배고파.' },
  { w: ['We', 'are', 'family.'], v: 1, be: true, k: '우리는 가족이야.' },
  { w: ['He', 'is', 'tall.'], v: 1, be: true, k: '그는 키가 커.' },
  { w: ['The', 'dogs', 'were', 'sleepy.'], v: 2, be: true, k: '그 개들은 졸렸어.' },
  { w: ['It', 'is', 'my', 'bag.'], v: 1, be: true, k: '그것은 내 가방이야.' },
  { w: ['She', 'was', 'sad.'], v: 1, be: true, k: '그녀는 슬펐어.' },
  { w: ['You', 'are', 'my', 'friend.'], v: 1, be: true, k: '너는 내 친구야.' },
  { w: ['The', 'test', 'was', 'easy.'], v: 2, be: true, k: '그 시험은 쉬웠어.' },
  { w: ['My', 'dad', 'is', 'busy.'], v: 2, be: true, k: '우리 아빠는 바빠.' },
  { w: ['The', 'room', 'was', 'dark.'], v: 2, be: true, k: '그 방은 어두웠어.' },
  { w: ['Her', 'bag', 'is', 'pink.'], v: 2, be: true, k: '그녀의 가방은 분홍색이야.' },
  { w: ['We', 'were', 'tired.'], v: 1, be: true, k: '우리는 피곤했어.' },
  { w: ['The', 'soup', 'is', 'hot.'], v: 2, be: true, k: '그 수프는 뜨거워.' },
  { w: ['They', 'are', 'students.'], v: 1, be: true, k: '그들은 학생이야.' },
  { w: ['I', 'was', 'late.'], v: 1, be: true, k: '나는 늦었어.' },
  { w: ['The', 'movie', 'was', 'long.'], v: 2, be: true, k: '그 영화는 길었어.' },
  { w: ['She', 'is', 'smart.'], v: 1, be: true, k: '그녀는 똑똑해.' },
  // am·were 문장을 보강한다 — 한 판에 그 형태가 아예 안 나오면 연습이 안 된 채 진급한다
  { w: ['I', 'am', 'ready.'], v: 1, be: true, k: '나는 준비됐어.' },
  { w: ['I', 'am', 'tired.'], v: 1, be: true, k: '나는 피곤해.' },
  { w: ['You', 'were', 'right.'], v: 1, be: true, k: '네 말이 맞았어.' },
  { w: ['We', 'were', 'friends.'], v: 1, be: true, k: '우리는 친구였어.' },
  { w: ['You', 'are', 'kind.'], v: 1, be: true, k: '너는 착해.' },
];

// ── 오답 연출 ────────────────────────────────────────────────
// 리서치 근거: 실패의 감정 톤을 '수치'에서 '아쉬움/개그'로 바꾼다.
// 빨간 X·경고음 대신, 잘못 잡은 단어가 말대꾸를 하고 도망간다.
// bubble = 단어의 말대꾸(개그), hint = 남는 한 줄(교육) — 역할을 나눈다.
// be동사 문장의 끝말(small·happy…)은 '꾸미는 말'이라고 하면 나중에 보어를 배울 때 말이 꼬인다.
// (꾸미는 말 = 명사에 붙는 말, 이건 주어의 상태를 말하는 자리) → "상태를 말하는 말"로 통일.
// 일반동사 문장의 끝말(fast·well·loudly)은 진짜 부사라서 '꾸미는 말'이 맞다.
export const DODGE = {
  'small.':  { bubble: '난 "작은"인데?ㅋ',        hint: '"작은"은 상태를 말하는 말! is가 진짜 동사예요.' },
  'happy.':  { bubble: '행복할 뿐 동사 아님~',     hint: '"행복한"은 상태를 말하는 말! are가 동사예요.' },
  'fun.':    { bubble: '재미만 담당함ㅎ',          hint: '"재미있는"은 상태를 말하는 말! was가 동사예요.' },
  'fast.':   { bubble: '난 그냥 빠를 뿐!',         hint: '"빠르게"는 꾸미는 말! 달리는 동작이 동사.' },
  'hungry.': { bubble: '배고픈 건 나지만ㅋ',       hint: '"배고픈"은 상태를 말하는 말! am이 동사예요.' },
  'tall.':   { bubble: '키만 클 뿐이야',           hint: '"키 큰"은 상태를 말하는 말! is가 동사예요.' },
  'sleepy.': { bubble: '졸려서 도망도 못 가겠다',  hint: '"졸린"은 상태를 말하는 말! were가 동사예요.' },
  'sad.':    { bubble: '슬프지만 동사는 아냐',     hint: '"슬픈"은 상태를 말하는 말! was가 동사예요.' },
  'easy.':   { bubble: '쉬워 보여도 난 아님ㅋ',    hint: '"쉬운"은 상태를 말하는 말! was가 동사예요.' },
  'busy.':   { bubble: '바빠서 이만~',             hint: '"바쁜"은 상태를 말하는 말! is가 동사예요.' },
  'dark.':   { bubble: '어두워서 잘못 봤지?',      hint: '"어두운"은 상태를 말하는 말! was가 동사예요.' },
  'pink.':   { bubble: '난 색깔이라구~',           hint: '"분홍색"은 상태를 말하는 말! is가 동사예요.' },
  'tired.':  { bubble: '피곤해서 안 잡힘ㅋ',       hint: '"피곤한"은 상태를 말하는 말! be동사가 동사예요.' },
  'hot.':    { bubble: '앗 뜨거! 놓쳤지?',         hint: '"뜨거운"은 상태를 말하는 말! is가 동사예요.' },
  'late.':   { bubble: '늦은 건 나지만 동사 아님', hint: '"늦은"은 상태를 말하는 말! was가 동사예요.' },
  'long.':   { bubble: '길기만 한 놈이야 난',      hint: '"긴"은 상태를 말하는 말! was가 동사예요.' },
  'smart.':  { bubble: '똑똑하면 뭐해 동사도 아닌데', hint: '"똑똑한"은 상태를 말하는 말! is가 동사예요.' },
  'ready.':  { bubble: '준비만 됐지 동사는 아냐',  hint: '"준비된"은 상태를 말하는 말! am이 동사예요.' },
  'right.':  { bubble: '맞는 건 맞는데 나 아님ㅋ', hint: '"맞은"은 상태를 말하는 말! were가 동사예요.' },
  'kind.':   { bubble: '착하다고 잡히진 않아~',    hint: '"착한"은 상태를 말하는 말! are가 동사예요.' },
  'well.':   { bubble: '난 "잘"이야, 거들 뿐',     hint: '"잘"은 꾸미는 말! 노래하는 동작이 동사.' },
  'here.':   { bubble: '여긴 그냥 장소야~',        hint: '"여기"는 장소 말! live가 동사예요.' },
  'loudly.': { bubble: '(크게) 나 아니라니까!',    hint: '"크게"는 꾸미는 말! cries가 동사예요.' },
};

/** 도감에 없는 단어를 잘못 잡았을 때 — 대명사(I/She…)에 "난 물건이야"가 나오면 안 되니 나눠 쓴다 */
const PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'her', 'his', 'the']);

export const DODGE_DEFAULT = [
  { bubble: '나 이름(명사)인데?ㅋ', hint: '주어(누가) 바로 다음 말을 봐요!' },
  { bubble: '난 물건이야, 움직이질 않아', hint: '동사는 "~하다/~이다" — 주어 바로 다음!' },
  { bubble: '헛 잡았다~', hint: '주어(누가) 바로 다음 말이 동사예요.' },
];

const DODGE_PRONOUN = [
  { bubble: '난 "누가"야! 주어라구', hint: '내(주어) 바로 다음 말이 동사예요.' },
  { bubble: '주어를 잡아서 뭐 하게~', hint: '동사는 주어 바로 다음! 한 칸 옆을 봐요.' },
];

/** 단어에 맞는 기본 도망 대사 하나 */
export function dodgeFor(word, rand = Math.random) {
  const key = word.replace(/[.!?]$/, '').toLowerCase();
  const pool = PRONOUNS.has(key) ? DODGE_PRONOUN : DODGE_DEFAULT;
  return pool[Math.floor(rand() * pool.length)];
}

// 주어 사냥 모드 전용 오답 대사
export const DODGE_SUBJ = {
  verb: { bubble: '난 동사야, "뭐 한다" 담당!', hint: '주어는 문장 맨 앞 덩어리 — "누가/무엇이"예요.' },
  after: { bubble: '난 문장 뒤쪽이야~', hint: '주어는 문장 맨 앞에서 시작해요.' },
};

export const CHEERS = ['잡았다!', '정확해요!', '오, 사냥꾼인데?', '깔끔한 포획!', '감 잡았네요?'];
export const CHUNK_CHEERS = ['덩어리째 포획!', '주어 통째로 잡았다!', '두 단어 다 찾았어!'];
