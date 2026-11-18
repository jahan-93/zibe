# 집으로

잃어버린 반려동물을 전국 보호소 구조 공고와 이웃의 목격 제보에서 찾아 주는 모바일 웹.

- **아이를 잃어버렸어요**: 사진·날짜·장소·특징을 등록하면 바로 닮은 순으로 후보를 보여 줘요. 로그인 없이 받은 링크로 다시 볼 수 있어요.
- **길에서 아이를 봤어요**: 목격 제보를 올리면 찾고 있는 보호자들의 등록과 바로 비교해요.
- **매일 아침 다시 찾기**: 백엔드 `daily` 함수가 새 공고를 받아 다시 비교하고, 내 등록을 열면 `새로 올라옴`으로 표시돼요.

## 실행

```bash
cp .env.example .env   # VITE_SUPABASE_ANON_KEY 채우기
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/
```

## 구조

```
src/
  api.ts            Supabase Edge Function `report` 호출 (등록 / 다시 보기 / 목격 제보)
  config.ts         환경 변수
  constants.ts      시·도, 털색, 품종 목록 (서버 core.js와 맞춤)
  lib/              주소(해시 라우터), 사진 줄이기, 날짜 표시, 이 기기에 저장한 내 등록
  components/       공통 머리말, 입력 칩, 사진 고르기, 후보 카드, 그림(사진 대신)
  pages/            처음 · 잃어버렸어요 · 봤어요 · 제보 고마워요 · 내 등록
```

## 백엔드 (Supabase)

| 호출 | 하는 일 |
| --- | --- |
| `POST /functions/v1/report` | 실종 등록 + 바로 비교 → `{ report, matches, token, stats }` |
| `GET /functions/v1/report?id=&token=` | 내 등록 다시 보기 (응답 뒤 `is_new`가 읽음 처리돼요) |
| `POST /functions/v1/report?type=sighting` | 목격 제보 → `{ compared, matched }` |

사진은 화면에서 긴 변 1280px JPEG로 줄여 data URL로 보내요 (서버 한도 6MB).
