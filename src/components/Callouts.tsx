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
      이번 결과는 공고에 적힌 정보(털색·품종·성별·장소·날짜·특징)로 순위를 매겼어요. AI 사진 비교는 사진이 있는 상위
      후보에만 하는데, 이번에는 이뤄지지 않았어요.
    </Callout>
  );
}

export function AiNotice() {
  return (
    <Callout tone="info" icon="📷">
      사진이 있는 후보는 <b>AI가 내 사진과 직접 비교</b>했어요. 같은 품종은 서로 닮아 보일 수 있으니, 점수가 높아도
      보호소에서 꼭 직접 확인해 주세요.
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
