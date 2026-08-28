// 문장 완성 라운드 — 동사 자리가 빈칸, 선택지는 "같은 동사의 다른 모습" 3개.
// 주어와 시간(어제/지금)을 보고 맞는 모습을 골라야 하므로 형태 판단이 연습된다.
// 문장은 동사사냥꾼 풀에서 가져와 형태 선택지를 붙였다 (둘 다 자작).
// w: 단어 배열, v: 동사 위치, k: 한국어 뜻, forms: 선택지 3개 (정답 = w[v]), why: 정답 이유 한 줄
export const VERB_Q = [
  { w: ['She', 'reads', 'books.'], v: 1, k: '그녀는 책을 읽어.', forms: ['read', 'reads', 'readed'], why: '주어가 한 명(She)이고 지금 얘기라서 -s를 붙여요.' },
  { w: ['They', 'play', 'soccer.'], v: 1, k: '그들은 축구를 해.', forms: ['play', 'plays', 'played'], why: '주어가 여럿(They)이고 지금 얘기라서 그대로 써요.' },
  { w: ['The', 'dog', 'runs', 'fast.'], v: 2, k: '그 개는 빨리 달려.', forms: ['run', 'runs', 'ran'], why: '주어가 한 마리(The dog)라서 -s를 붙여요.' },
  { w: ['We', 'eat', 'lunch.'], v: 1, k: '우리는 점심을 먹어.', forms: ['eat', 'eats', 'ate'], why: '주어가 여럿(We)이고 지금 얘기라서 그대로 써요.' },
  { w: ['He', 'sleeps', 'late.'], v: 1, k: '그는 늦게 자.', forms: ['sleep', 'sleeps', 'slept'], why: '주어가 한 명(He)이고 지금 얘기라서 -s를 붙여요.' },
  { w: ['She', 'made', 'a', 'cake.'], v: 1, k: '그녀는 케이크를 만들었어.', forms: ['make', 'makes', 'made'], why: '"만들었어" — 지난 일이라서 과거 모습을 써요.' },
  { w: ['I', 'go', 'to', 'school.'], v: 1, k: '나는 학교에 가.', forms: ['go', 'goes', 'went'], why: '주어가 I(나)이고 지금 얘기라서 그대로 써요.' },
  { w: ['Birds', 'sing', 'songs.'], v: 1, k: '새들은 노래를 불러.', forms: ['sing', 'sings', 'sang'], why: '주어가 여럿(Birds)이라서 그대로 써요.' },
  { w: ['He', 'drinks', 'milk.'], v: 1, k: '그는 우유를 마셔.', forms: ['drink', 'drinks', 'drank'], why: '주어가 한 명(He)이고 지금 얘기라서 -s를 붙여요.' },
  { w: ['They', 'live', 'here.'], v: 1, k: '그들은 여기 살아.', forms: ['live', 'lives', 'lived'], why: '주어가 여럿(They)이고 지금 얘기라서 그대로 써요.' },
  { w: ['My', 'sister', 'draws', 'cats.'], v: 2, k: '내 여동생은 고양이를 그려.', forms: ['draw', 'draws', 'drew'], why: '주어가 한 명(My sister)이라서 -s를 붙여요.' },
  { w: ['The', 'baby', 'cries', 'loudly.'], v: 2, k: '그 아기는 크게 울어.', forms: ['cry', 'cries', 'cried'], why: '주어가 한 명(The baby)이라서 cries로 바꿔요.' },
  { w: ['He', 'opens', 'the', 'door.'], v: 1, k: '그는 문을 열어.', forms: ['open', 'opens', 'opened'], why: '주어가 한 명(He)이고 지금 얘기라서 -s를 붙여요.' },
  { w: ['My', 'mom', 'cooks', 'dinner.'], v: 2, k: '우리 엄마는 저녁을 요리해.', forms: ['cook', 'cooks', 'cooked'], why: '주어가 한 명(My mom)이라서 -s를 붙여요.' },
  { w: ['The', 'kids', 'play', 'games.'], v: 2, k: '그 아이들은 게임을 해.', forms: ['play', 'plays', 'played'], why: '주어가 여럿(The kids)이라서 그대로 써요.' },
  { w: ['The', 'girl', 'sings', 'songs.'], v: 2, k: '그 여자애는 노래를 불러.', forms: ['sing', 'sings', 'sang'], why: '주어가 한 명(The girl)이라서 -s를 붙여요.' },
  { w: ['I', 'found', 'my', 'key.'], v: 1, k: '나는 내 열쇠를 찾았어.', forms: ['find', 'finds', 'found'], why: '"찾았어" — 지난 일이라서 과거 모습을 써요.' },
  { w: ['She', 'bought', 'new', 'shoes.'], v: 1, k: '그녀는 새 신발을 샀어.', forms: ['buy', 'buys', 'bought'], why: '"샀어" — 지난 일이라서 과거 모습을 써요.' },
  { w: ['He', 'gave', 'me', 'candy.'], v: 1, k: '그는 나에게 사탕을 줬어.', forms: ['give', 'gives', 'gave'], why: '"줬어" — 지난 일이라서 과거 모습을 써요.' },
  { w: ['We', 'watched', 'a', 'movie.'], v: 1, k: '우리는 영화를 봤어.', forms: ['watch', 'watches', 'watched'], why: '"봤어" — 지난 일이라서 과거 모습을 써요.' },
  { w: ['My', 'dad', 'sent', 'a', 'letter.'], v: 2, k: '우리 아빠는 편지를 보냈어.', forms: ['send', 'sends', 'sent'], why: '"보냈어" — 지난 일이라서 과거 모습을 써요.' },
  { w: ['The', 'boy', 'told', 'a', 'joke.'], v: 2, k: '그 남자애는 농담을 했어.', forms: ['tell', 'tells', 'told'], why: '"했어(말했어)" — 지난 일이라서 과거 모습을 써요.' },
  // be동사 — 유령 소환과 같은 규칙 (같은 시제 가족만 선택지로)
  { w: ['The', 'cat', 'is', 'small.'], v: 2, k: '그 고양이는 작아.', forms: ['am', 'is', 'are'], why: '주어가 한 마리(The cat)라서 is를 써요.' },
  { w: ['My', 'friends', 'are', 'happy.'], v: 2, k: '내 친구들은 행복해.', forms: ['am', 'is', 'are'], why: '주어가 여럿(My friends)이라서 are를 써요.' },
  { w: ['I', 'am', 'hungry.'], v: 1, k: '나는 배고파.', forms: ['am', 'is', 'are'], why: 'I(나)의 짝은 언제나 am이에요.' },
  { w: ['The', 'game', 'was', 'fun.'], v: 2, k: '그 게임은 재미있었어.', forms: ['was', 'were'], why: '주어가 하나(The game)이고 지난 일이라서 was예요.' },
  { w: ['The', 'dogs', 'were', 'sleepy.'], v: 2, k: '그 개들은 졸렸어.', forms: ['was', 'were'], why: '주어가 여럿(The dogs)이고 지난 일이라서 were예요.' },
  { w: ['You', 'are', 'kind.'], v: 1, k: '너는 착해.', forms: ['am', 'is', 'are'], why: 'You(너)의 짝은 are예요.' },
  { w: ['We', 'were', 'tired.'], v: 1, k: '우리는 피곤했어.', forms: ['was', 'were'], why: '주어가 여럿(We)이고 지난 일이라서 were예요.' },
  { w: ['She', 'was', 'sad.'], v: 1, k: '그녀는 슬펐어.', forms: ['was', 'were'], why: '주어가 한 명(She)이고 지난 일이라서 was예요.' },
  { w: ['They', 'are', 'students.'], v: 1, k: '그들은 학생이야.', forms: ['am', 'is', 'are'], why: '주어가 여럿(They)이라서 are를 써요.' },
  { w: ['The', 'soup', 'is', 'hot.'], v: 2, k: '그 수프는 뜨거워.', forms: ['am', 'is', 'are'], why: '주어가 하나(The soup)라서 is를 써요.' },
];
