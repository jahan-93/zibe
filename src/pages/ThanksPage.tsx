import { Callout } from '../components/Callouts';
import { BackLink } from '../components/Chrome';
import { peekSighting } from '../lib/store';

export function ThanksPage() {
  const r = peekSighting();

  return (
    <>
      <BackLink />
      <section className="thanks">
        <div className="thanks__icon" aria-hidden="true">
          💌
        </div>
        <h1>제보 고마워요</h1>
        {r && (
          <p>
            {r.compared > 0
              ? `근처에서 찾고 있는 보호자 ${r.compared}명의 등록과 비교했어요.`
              : '지금 근처에서 찾고 있는 보호자 등록은 없어요.'}
          </p>
        )}
      </section>

      {r && r.matched > 0 ? (
        <Callout tone="success" icon="🔔" title={`닮은 아이를 찾는 보호자 ${r.matched}명에게 알렸어요.`}>
          보호자가 자기 등록을 열면 이 제보가 후보로 보여요.
        </Callout>
      ) : (
        <Callout tone="neutral" icon="🔁" title="새로 등록하는 보호자와도 계속 비교돼요.">
          오늘 이후에 등록하는 보호자에게도 닮은 아이로 보여 줄게요.
        </Callout>
      )}

      <Callout tone="info" icon="🚑">
        아이가 다쳤거나 위험해 보이면 가까운 시·군·구청 동물보호 담당이나 동물보호센터에 알려 주세요.
      </Callout>

      <div className="stack">
        <a href="#/seen" className="btn btn--primary">
          한 마리 더 제보하기
        </a>
        <a href="#/" className="btn btn--ghost">
          처음으로
        </a>
      </div>
    </>
  );
}
