import type { ReactNode } from 'react';

export function Callout({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'info' | 'danger' | 'success' | 'neutral';
  icon?: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`callout callout--${tone}`}>
      {icon && (
        <span className="callout__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div>
        {title && <p className="callout__title">{title}</p>}
        {children && <div className="callout__body">{children}</div>}
      </div>
    </div>
  );
}

export function RuleNotice() {
  return (
    <Callout tone="info">
      지금은 공고에 적힌 정보(털색·품종·성별·장소·날짜·특징)로 순위를 매겨요. 사진끼리 비교하는 AI는 곧 연결돼요.
    </Callout>
  );
}

export function ScamWarning() {
  return (
    <Callout tone="danger" icon="⚠️" title="먼저 돈을 보내지 마세요.">
      "데리고 있으니 사례금부터 보내라"는 연락은 사기일 수 있어요. 보호소나 제보자를 직접 만나 확인한 뒤에
      사례하세요.
    </Callout>
  );
}
