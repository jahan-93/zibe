import type { Sex, Species } from './api';

// 서버(_shared/core.js)의 SIDO_LIST와 같아야 해요.
export const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도',
  '경상북도', '경상남도', '제주특별자치도',
] as const;

export const SPECIES_OPTIONS: { value: Species; label: string; icon: string }[] = [
  { value: 'dog', label: '강아지', icon: '🐶' },
  { value: 'cat', label: '고양이', icon: '🐱' },
];

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'M', label: '수컷' },
  { value: 'F', label: '암컷' },
  { value: 'Q', label: '잘 모름' },
];

// 서버가 '흰', '백색', '화이트'처럼 다른 표기도 같은 색으로 묶어 비교해요.
export const COLOR_OPTIONS = ['흰색', '검정', '갈색', '크림', '회색', '노랑(치즈)', '삼색', '고등어'] as const;

// 공고의 털색 글자('갈색&검정&흰색', '치즈(노랑)' 등)를 화면의 털색 칩으로 바꾸기
const COLOR_PATTERNS: [RegExp, (typeof COLOR_OPTIONS)[number]][] = [
  [/흰|하얀|백색|화이트|아이보리/, '흰색'],
  [/검|흑|블랙|까만/, '검정'],
  [/갈|브라운|초코|밤색|레드/, '갈색'],
  [/크림|베이지|살구/, '크림'],
  [/회|그레이|은색|실버|블루/, '회색'],
  [/노랑|황|누렁|치즈|오렌지|주황/, '노랑(치즈)'],
  [/삼색|카오스/, '삼색'],
  [/고등어|태비|줄무늬/, '고등어'],
];
export function colorsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  return COLOR_PATTERNS.filter(([re]) => re.test(text)).map(([, c]) => c).slice(0, 3);
}

export const BREED_SUGGESTIONS: Record<Species, string[]> = {
  dog: [
    '믹스견', '말티즈', '푸들', '포메라니안', '시츄', '비숑 프리제', '진도견', '진도견 믹스', '치와와',
    '요크셔테리어', '닥스훈트', '웰시코기', '골든 리트리버', '래브라도 리트리버', '보더콜리', '슈나우저',
    '스피츠', '시바견', '비글', '허스키', '페키니즈',
  ],
  cat: [
    '코리안숏헤어', '러시안 블루', '페르시안', '스코티시폴드', '브리티시숏헤어', '먼치킨', '샴', '랙돌',
    '노르웨이숲', '아비시니안', '벵갈', '터키시앙고라', '믹스',
  ],
  etc: [],
};
