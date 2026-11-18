// 모든 화면에 공통으로 붙는 머리말·꼬리말·뒤로가기
import { SAMPLE_MODE } from '../config';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3.5 3.8 13.6a2 2 0 0 0-.8 1.6V27a2 2 0 0 0 2 2h22a2 2 0 0 0 2-2V15.2a2 2 0 0 0-.8-1.6Z" fill="#E0703A" />
      <ellipse cx="16" cy="21.6" rx="4.4" ry="3.6" fill="#fff" />
      <circle cx="10.6" cy="17" r="1.9" fill="#fff" />
      <circle cx="14" cy="14.2" r="1.9" fill="#fff" />
      <circle cx="18" cy="14.2" r="1.9" fill="#fff" />
      <circle cx="21.4" cy="17" r="1.9" fill="#fff" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="topbar">
      <a href="#/" className="brand" aria-label="집으로 처음 화면">
        <Logo />
        <span>집으로</span>
      </a>
      {SAMPLE_MODE && <span className="sample-badge">미리보기 · 예시 데이터</span>}
    </header>
  );
}

export function BackLink() {
  return (
    <a href="#/" className="backlink">
      <span aria-hidden="true">←</span> 처음으로
    </a>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <p>공고 정보: 농림축산식품부 국가동물보호정보시스템 구조동물 조회 공공 API</p>
      {SAMPLE_MODE && (
        <p>
          지금은 미리보기라 <b>예시 공고</b>로 보여 드려요. 실제 보호소 정보가 아니에요.
        </p>
      )}
      <p>가까운 보호소에 직접 전화해 확인하는 게 가장 빨라요.</p>
    </footer>
  );
}
