import { useEffect, useState } from 'react';
import { getReport, type ReportView } from '../api';
import { AiNotice, Callout, RuleNotice, ScamWarning } from '../components/Callouts';
import { BackLink } from '../components/Chrome';
import { DemoTag } from '../components/Demo';
import { MatchCard } from '../components/MatchCard';
import { PetArt } from '../components/PetArt';
import { toast } from '../components/Toast';
import { dateTimeKST, joinDot, monthDay, sexLabel, speciesLabel } from '../lib/format';
import { reportLink } from '../lib/router';
import { clearFreshReport, peekFreshReport, rememberReport } from '../lib/store';

interface Loaded {
  view: ReportView;
  /** 방금 등록해서 POST 결과를 그대로 보여 주는 중 */
  fresh: boolean;
}

// GET은 '새로 올라옴'을 읽음 처리하는 부수효과가 있어요. 같은 등록을 거의 동시에 두 번 부르면
// 두 번째 응답에서 새 소식이 사라지므로, 진행 중인 요청은 함께 써요.
const inflight = new Map<string, Promise<ReportView>>();
function loadReport(id: string, token: string) {
  const key = `${id}/${token}`;
  let p = inflight.get(key);
  if (!p) {
    p = getReport(id, token);
    inflight.set(key, p);
    p.finally(() => window.setTimeout(() => inflight.delete(key), 1500)).catch(() => {});
  }
  return p;
}

export function ReportPage({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<Loaded | null>(() => {
    const v = peekFreshReport(id);
    return v ? { view: v, fresh: true } : null;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (state?.fresh) {
      // 방금 보여 준 후보를 '본 것'으로 표시해 두면, 다음에 열 때 새로 찾은 아이만 '새로 올라옴'이 붙어요.
      loadReport(id, token)
        .catch(() => {})
        .finally(() => clearFreshReport(id));
      return;
    }
    loadReport(id, token)
      .then((view) => {
        if (!alive) return;
        setState({ view, fresh: false });
        rememberReport(view, token);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, token]); // state.fresh는 처음 한 번만 보면 돼요

  const copyLink = async () => {
    const url = reportLink(id, token);
    try {
      await navigator.clipboard.writeText(url);
      toast('링크를 복사했어요. 메모나 메신저에 저장해 두세요.');
    } catch {
      window.prompt('이 링크를 복사해 두세요', url);
    }
  };

  if (error) {
    return (
      <>
        <BackLink />
        <Callout tone="danger" icon="🔍" title="등록을 찾을 수 없어요">
          {error} 처음 받은 링크를 그대로 열었는지 확인해 주세요.
        </Callout>
        <a href="#/lost" className="btn btn--primary">
          새로 등록하기
        </a>
      </>
    );
  }

  if (!state) {
    return (
      <>
        <BackLink />
        <div className="summary" aria-busy="true" aria-label="등록을 불러오는 중">
          <div className="summary__thumb skeleton" />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 22, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 14, width: '70%' }} />
          </div>
        </div>
        <div className="skeleton" style={{ height: 320 }} />
      </>
    );
  }

  const { view, fresh } = state;
  const r = view.report;
  const ms = view.matches;
  const newCount = fresh ? 0 : ms.filter((m) => m.is_new).length;
  const aiCount = ms.filter((m) => m.method === 'ai').length;
  const title = ms.length === 0 ? '아직 후보가 없어요' : fresh ? `닮은 아이 ${ms.length}마리를 찾았어요` : '내 등록';
  // 체험 등록이면 '정답'(등록 사진의 주인공이 실린 실제 공고)이 몇 위에 있는지
  const answerIdx = r.demo_notice_id ? ms.findIndex((m) => m.kind === 'notice' && m.id === r.demo_notice_id) : -1;
  const answer = answerIdx >= 0 ? ms[answerIdx] : null;
  // 정보는 비슷했지만 AI가 사진을 보고 다른 아이로 판단해 아래로 내린 후보 수
  const aiRejected = ms.filter((m) => m.method === 'ai' && (m.photo_score ?? 100) < 40).length;

  return (
    <>
      <BackLink />

      <section className="summary">
        <div className="summary__thumb">
          {r.photo ? <img src={r.photo} alt="등록한 사진" /> : <PetArt species={r.species} color={r.color} label={false} />}
        </div>
        <div>
          {r.is_demo && <DemoTag />}
          <h1 className="summary__title">{title}</h1>
          <p className="summary__line">{joinDot([speciesLabel(r.species), r.breed, r.color, sexLabel(r.sex)])}</p>
          <p className="summary__line">
            {monthDay(r.lost_date)} · {[r.sido, r.sigungu].filter(Boolean).join(' ')}에서 잃어버림
          </p>
        </div>
      </section>

      {r.is_demo && (
        <section className={`answer ${answer ? 'is-found' : 'is-miss'}`} aria-label="체험 결과">
          <p className="answer__big">
            {answer ? (
              <>
                <span aria-hidden="true">🎯</span> 정답 공고가 <b>{answerIdx + 1}위</b>에 있어요
              </>
            ) : (
              <>정답 공고가 이번 후보에는 없어요</>
            )}
          </p>
          <p className="answer__sub">
            {answer && answer.method === 'ai' && answer.photo_score != null
              ? `AI가 등록 사진과 공고 사진을 직접 비교해 같은 아이일 가능성을 ${answer.photo_score}점으로 봤어요. (정보 ${answer.rule_score ?? '-'}점과 합쳐 ${answer.score}점)`
              : aiCount === 0
                ? '이번에는 AI 사진 비교가 이뤄지지 않았어요(무료 AI 사용량이 잠시 찼을 수 있어요). 털색·품종·지역·날짜 정보로만 순위를 매겼어요. 잠시 뒤 다른 예시로 다시 해 보세요.'
                : answer
                  ? '털색·품종·지역·날짜 정보로 찾았어요. AI 사진 비교는 정보 점수가 가장 높은 후보 몇 마리에만 해서, 이번에는 이 공고까지 닿지 않았어요.'
                  : '같은 날 같은 지역에 비슷한 아이가 많아 상위 10마리 안에 들지 못했거나, 입력 내용을 바꿨거나, 그사이 보호가 끝났을 수 있어요. 다른 예시로도 해 보세요.'}
          </p>
          {aiRejected > 0 && (
            <p className="answer__sub">
              <span aria-hidden="true">📷</span> 털색·품종·지역이 비슷한 후보 중 <b>{aiRejected}마리</b>는 AI가 사진을 보고 다른
              아이로 판단해 아래로 내렸어요.
            </p>
          )}
          <p className="answer__fine">
            등록 사진은 이 공고에 실린 같은 아이의 <b>다른 사진</b>이에요. 전국 공고 중에서 같은 아이를 찾아내는지 보는
            체험이에요.
          </p>
        </section>
      )}

      {fresh && view.stats && (
        <p className="funnel">
          최근 공고·제보 <b>{view.stats.total}건</b>
          <span className="funnel__arrow" aria-hidden="true">
            →
          </span>
          날짜·지역·종이 맞는 <b>{view.stats.poolSize}마리</b>
          <span className="funnel__arrow" aria-hidden="true">
            →
          </span>
          닮은 순 <b>{ms.length}마리</b>
        </p>
      )}

      {!fresh && ms.length > 0 && (
        <p className="newpill">
          {newCount > 0 ? (
            <>
              <span aria-hidden="true">🔔</span> 지난번 이후 <b>{newCount}마리</b>를 새로 찾았어요
            </>
          ) : (
            <>지난번 이후 새로 찾은 아이는 없어요</>
          )}
        </p>
      )}

      {aiCount > 0 ? <AiNotice /> : <RuleNotice />}

      {ms.length > 0 ? (
        <div className="matches">
          {ms.map((m, i) => (
            <MatchCard
              key={`${m.kind}-${m.id}`}
              m={m}
              rank={i + 1}
              species={r.species}
              showNew={!fresh}
              defaultOpen={i === 0}
              isAnswer={i === answerIdx}
              demo={!!r.is_demo}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          아직 조건에 맞는 공고가 없어요.
          <br />
          매일 아침 새 공고와 다시 비교해 둘게요.
        </div>
      )}

      <ScamWarning />

      {r.is_demo ? (
        <section className="recheck recheck--demo">
          <h2>
            <span aria-hidden="true">🧪</span> 이어서 체험해 보기
          </h2>
          <p>같은 아이를 '길에서 봤어요'로 제보하면, 이 체험 등록에 목격 제보 후보로 연결되는 걸 볼 수 있어요.</p>
          <a href="#/seen/demo" className="btn btn--primary">
            ② 길에서 봤어요 체험하기
          </a>
          <a href="#/lost/demo" className="btn btn--ghost">
            다른 아이로 다시 체험하기
          </a>
          <p className="recheck__meta">체험 등록은 실제 보호자에게 보이지 않고, 매일 다시 찾기에서도 빠져요.</p>
        </section>
      ) : (
      <section className="recheck">
        <h2>
          <span aria-hidden="true">🔁</span> 매일 아침 다시 찾아 드려요
        </h2>
        <p>새 구조 공고와 목격 제보가 올라오면 자동으로 다시 비교해요. 아래 링크를 저장해 두면 언제든 다시 볼 수 있어요.</p>
        <button type="button" className="btn btn--primary" onClick={copyLink}>
          <span aria-hidden="true">🔗</span> 내 등록 링크 복사
        </button>
        {r.last_checked_at && <p className="recheck__meta">마지막 비교 {dateTimeKST(r.last_checked_at)}</p>}
      </section>
      )}
    </>
  );
}
