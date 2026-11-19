import { Callout } from '../components/Callouts';
import { BackLink } from '../components/Chrome';
import { DemoTag } from '../components/Demo';
import { reportPath } from '../lib/router';
import { loadSaved, peekSighting } from '../lib/store';

function DemoThanks({ matched, forReport }: { matched: number; forReport: string | null | undefined }) {
  const saved = forReport ? loadSaved().find((s) => s.id === forReport) : null;
  return (
    <>
      <BackLink />
      <section className="thanks">
        <div className="thanks__icon" aria-hidden="true">
          🧪
        </div>
        <h1>
          <DemoTag /> 체험 제보를 보냈어요
        </h1>
        <p>
          {saved
            ? '이 기기에서 만든 체험 등록과 비교했어요.'
            : '최근 체험 등록과 비교했어요. 먼저 ① 잃어버렸어요 체험을 하면 결과를 바로 이어서 볼 수 있어요.'}
        </p>
      </section>

      {saved && matched > 0 ? (
        <Callout tone="success" icon="🔔" title="체험 등록에 이 제보가 후보로 연결됐어요.">
          보호자 화면에서 '목격 제보' 카드를 확인해 보세요. 사진 비교가 됐다면 AI 결과도 함께 보여요.
        </Callout>
      ) : saved ? (
        <Callout tone="neutral" icon="🔍" title="체험 등록과는 맞지 않았어요.">
          ① 잃어버렸어요 체험에서 고른 아이와 같은 아이를 고르면 연결되는 걸 볼 수 있어요.
        </Callout>
      ) : null}

      <div className="stack">
        {saved ? (
          <a href={`#${reportPath(saved.id, saved.token)}`} className="btn btn--primary">
            체험 등록에서 결과 보기
          </a>
        ) : (
          <a href="#/lost/demo" className="btn btn--primary">
            ① 잃어버렸어요 체험하기
          </a>
        )}
        <a href="#/seen/demo" className="btn btn--ghost">
          다른 예시로 다시 제보해 보기
        </a>
      </div>
    </>
  );
}

export function ThanksPage() {
  const r = peekSighting();
  if (r?.demo) return <DemoThanks matched={r.matched} forReport={r.for_report} />;

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
