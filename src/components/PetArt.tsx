// 사진이 없는 공고·예시 사진에 쓰는 그림. 털색 글자를 보고 그림 색을 맞춰요.
import type { Species } from '../api';

interface Fur {
  fur: string;
  ear: string;
  muzzle: string;
  stripes?: boolean;
  patch?: string;
}

const FURS: [RegExp, Fur][] = [
  [/삼색|카오스/, { fur: '#F7F2EA', ear: '#E39A4E', muzzle: '#FFFFFF', patch: '#4A4340' }],
  [/고등어|태비|줄무늬/, { fur: '#A69E92', ear: '#7C746A', muzzle: '#D9D3CA', stripes: true }],
  [/치즈|노랑|황|누렁|오렌지|주황/, { fur: '#EBA955', ear: '#C9843A', muzzle: '#F6D9A8' }],
  [/검|흑|블랙|까만/, { fur: '#4D4542', ear: '#2F2927', muzzle: '#6E6460' }],
  [/갈|브라운|초코|밤색|레드/, { fur: '#A9724B', ear: '#7D5236', muzzle: '#D6AE8A' }],
  [/크림|베이지|살구|연갈/, { fur: '#F2DEC0', ear: '#DDBF97', muzzle: '#FBF0DF' }],
  [/회|그레이|은색|실버|블루/, { fur: '#B8B4B0', ear: '#8C8885', muzzle: '#DEDBD8' }],
  [/흰|하얀|백색|화이트|아이보리/, { fur: '#F7F2EA', ear: '#E3D9CB', muzzle: '#FFFFFF' }],
];
const DEFAULT_FUR: Fur = { fur: '#F7F2EA', ear: '#E3D9CB', muzzle: '#FFFFFF' };

export const ART_BACKGROUNDS = ['#FBE3D6', '#DCEFE6', '#FCEFC9', '#DDEBF5', '#EFE3F3'];

export function furFor(color?: string | null): Fur {
  if (!color) return DEFAULT_FUR;
  return FURS.find(([re]) => re.test(color))?.[1] ?? DEFAULT_FUR;
}

const INK = '#2B2522';

function dog(f: Fur) {
  return `
  <ellipse cx="128" cy="150" rx="38" ry="74" transform="rotate(18 128 150)" fill="${f.ear}"/>
  <ellipse cx="272" cy="150" rx="38" ry="74" transform="rotate(-18 272 150)" fill="${f.ear}"/>
  <circle cx="200" cy="148" r="90" fill="${f.fur}"/>
  ${f.patch ? `<path d="M200 58a90 90 0 0 1 84 58c-30 6-58-6-74-30z" fill="${f.patch}" opacity=".85"/>` : ''}
  <ellipse cx="200" cy="188" rx="44" ry="33" fill="${f.muzzle}"/>
  <circle cx="166" cy="140" r="9.5" fill="${INK}"/><circle cx="234" cy="140" r="9.5" fill="${INK}"/>
  <circle cx="169.5" cy="136.5" r="3" fill="#fff"/><circle cx="237.5" cy="136.5" r="3" fill="#fff"/>
  <path d="M187 172c0-6 26-6 26 0 0 7-8 12-13 12s-13-5-13-12z" fill="${INK}"/>
  <path d="M200 184v7M186 193c6 7 22 7 28 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <ellipse cx="148" cy="176" rx="12" ry="7" fill="#F28B7A" opacity=".28"/>
  <ellipse cx="252" cy="176" rx="12" ry="7" fill="#F28B7A" opacity=".28"/>`;
}

function cat(f: Fur) {
  return `
  <path d="M112 128 128 36l64 54z" fill="${f.fur}"/><path d="M288 128 272 36l-64 54z" fill="${f.fur}"/>
  <path d="M126 104 134 60l32 28z" fill="#F2A9A0" opacity=".7"/><path d="M274 104 266 60l-32 28z" fill="#F2A9A0" opacity=".7"/>
  <ellipse cx="200" cy="156" rx="102" ry="86" fill="${f.fur}"/>
  ${f.stripes ? `<path d="M200 76v26M178 80l6 22M222 80l-6 22M104 150h26M100 170h26M296 150h-26M300 170h-26" stroke="${f.ear}" stroke-width="7" stroke-linecap="round"/>` : ''}
  ${f.patch ? `<path d="M110 120c10-40 50-58 80-52-4 30-36 52-80 52z" fill="${f.patch}" opacity=".85"/><path d="M290 132c-8-30-30-50-58-58 0 30 24 52 58 58z" fill="${f.ear}"/>` : ''}
  <ellipse cx="200" cy="190" rx="38" ry="26" fill="${f.muzzle}"/>
  <ellipse cx="164" cy="148" rx="10" ry="12.5" fill="${INK}"/><ellipse cx="236" cy="148" rx="10" ry="12.5" fill="${INK}"/>
  <circle cx="167.5" cy="143.5" r="3.2" fill="#fff"/><circle cx="239.5" cy="143.5" r="3.2" fill="#fff"/>
  <path d="M192 176h16l-8 9z" fill="#E98A86"/>
  <path d="M200 185c-2 8-10 11-15 7M200 185c2 8 10 11 15 7" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M150 186l-48-8M150 196l-46 6M250 186l48-8M250 196l46 6" stroke="${INK}" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round"/>
  <ellipse cx="146" cy="178" rx="11" ry="6" fill="#F28B7A" opacity=".25"/>
  <ellipse cx="254" cy="178" rx="11" ry="6" fill="#F28B7A" opacity=".25"/>`;
}

/** 400×300 SVG 문자열 (예시 사진 만들 때도 써요) */
export function petSvg(species: Species | string, color?: string | null, bg = ART_BACKGROUNDS[0]) {
  const f = furFor(color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" preserveAspectRatio="xMidYMid slice">
  <rect width="400" height="300" fill="${bg}"/>
  <ellipse cx="200" cy="270" rx="130" ry="20" fill="#000" opacity=".06"/>
  <g transform="translate(0 22)">${species === 'cat' ? cat(f) : dog(f)}</g>
</svg>`;
}

export function PetArt({
  species,
  color,
  bg,
  label = true,
  className = '',
}: {
  species: Species | string;
  color?: string | null;
  bg?: string;
  label?: boolean;
  className?: string;
}) {
  return (
    <div className={`pet-art ${className}`} role="img" aria-label={label ? '사진 대신 그림' : undefined}>
      <div className="pet-art__svg" dangerouslySetInnerHTML={{ __html: petSvg(species, color, bg) }} />
      {label && <span className="pet-art__label">사진 대신 그림</span>}
    </div>
  );
}
