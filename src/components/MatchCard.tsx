import { useState } from 'react';
import type { Match, Species } from '../api';
import { joinDot, monthDay, sexLabel } from '../lib/format';
import { ART_BACKGROUNDS, PetArt } from './PetArt';
import { toast } from './Toast';

const LOW_SCORE = 30;

function DdayBox({ days }: { days: number | null | undefined }) {
  if (days == null) return null;
  const over = days <= 0;
  const urgent = !over && days <= 3;
  return (
    <div className={`dday ${urgent ? 'is-urgent' : ''} ${over ? 'is-over' : ''}`}>
      <span className="dday__cap">소유권 이전까지</span>
      <b className="dday__num">{over ? '기간 지남' : `D-${days}`}</b>
    </div>
  );
}

function ScoreBar({ score, label = '정보 일치' }: { score: number; label?: string }) {
  const pct = Math.max(4, Math.min(100, score));
  const tier = score >= 70 ? 'hi' : score >= 45 ? 'mid' : 'lo';
  return (
    <div className="score">
      <span className="score__label">{label}</span>
      <div
        className="score__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={99}
        aria-valuenow={score}
        aria-label="정보 일치 점수"
      >
        <div className={`score__fill score__fill--${tier}`} style={{ width: `${pct}%` }} />
      </div>
      <b className="score__num">{score}</b>
    </div>
  );
}

// '사진: 왼쪽 귀 얼룩'처럼 AI가 사진에서 찾은 근거는 📷로 구분해서 보여 줘요.
function Reason({ kind, text }: { kind: 'same' | 'diff'; text: string }) {
  const fromPhoto = text.startsWith('사진: ');
  const body = fromPhoto ? text.slice(4) : text;
  return (
    <li className={`reason reason--${kind} ${fromPhoto ? 'reason--photo' : ''}`}>
      <span aria-hidden="true">{fromPhoto ? '📷' : kind === 'same' ? '✓' : '✕'}</span>
      {fromPhoto && <span className="sr-only">사진에서 {kind === 'same' ? '닮은 점' : '다른 점'}:</span>} {body}
    </li>
  );
}

function Photo({ m, species, index }: { m: Match; species: Species; index: number }) {
  const [broken, setBroken] = useState(false);
  const bg = ART_BACKGROUNDS[index % ART_BACKGROUNDS.length];
  if (!m.photo || broken) return <PetArt species={species} color={m.color} bg={bg} />;
  return <img className="match__img" src={m.photo} alt="" loading="lazy" onError={() => setBroken(true)} />;
}

export function MatchCard({
  m,
  rank,
  species,
  showNew,
  defaultOpen,
  isAnswer = false,
  demo = false,
}: {
  m: Match;
  rank: number;
  species: Species;
  showNew: boolean;
  defaultOpen?: boolean;
  /** 체험 정답 (등록 사진의 주인공이 실린 공고) */
  isAnswer?: boolean;
  /** 체험 등록: 실제 보호소로 전화가 걸리지 않게 막아요 */
  demo?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const isSighting = m.kind === 'sighting';
  const isAi = m.method === 'ai' && m.photo_score != null;
  const title = isSighting
    ? joinDot(['목격 제보', m.color || '색 정보 없음'])
    : joinDot([m.title || '품종 모름', sexLabel(m.sex), m.color]);
  const verb = isSighting ? '목격' : '구조';
  // 서버의 이유 문장은 공고 기준('…에서 구조')이라 목격 제보에서는 '목격'으로 바꿔 보여 줘요.
  const reword = (s: string) => (isSighting ? s.replace(/구조/g, '목격') : s);

  const callShelter = (e: React.MouseEvent) => {
    if (m.is_sample) {
      e.preventDefault();
      toast('예시 공고라 실제로 연결되지 않아요.');
    }
  };

  return (
    <article className={`match ${m.score < LOW_SCORE ? 'is-low' : ''} ${isAnswer ? 'is-answer' : ''}`}>
      <div className="match__photo">
        <Photo m={m} species={species} index={rank - 1} />
        <span className="match__rank">{rank}위</span>
        <div className="match__badges">
          {isAnswer && <span className="badge badge--answer">🎯 체험 정답</span>}
          {showNew && m.is_new && <span className="badge badge--new">새로 올라옴</span>}
          {isSighting && <span className="badge badge--sighting">목격 제보</span>}
          {m.score < LOW_SCORE && <span className="badge badge--low">가능성 낮음</span>}
          {m.is_sample && <span className="badge">예시 공고</span>}
        </div>
      </div>

      <div className="match__body">
        <div className="match__head">
          <div className="match__titles">
            <h3 className="match__title">{title}</h3>
            <p className="match__meta">
              {monthDay(m.date)} {verb}
              {m.place ? ` · ${m.place}` : ''}
            </p>
            {m.care_name && (
              <p className="match__care">
                <span aria-hidden="true">🏠</span> {m.care_name}
              </p>
            )}
          </div>
          {!isSighting && <DdayBox days={m.days_left} />}
        </div>

        {/* 사진 비교를 한 후보는 종합 점수, 못 한 후보는 정보 점수를 보여 줘요 (줄 세우기는 둘 다 같은 잣대) */}
        <ScoreBar score={isAi ? m.score : (m.rule_score ?? m.score)} label={isAi ? '종합 일치' : '정보 일치'} />

        {isAi && (
          <div className="ai-box">
            <div className="ai-box__head">
              <span className="ai-box__tag">AI 사진 비교</span>
              <span className="ai-box__scores">
                사진 <b>{m.photo_score}</b>
                <span aria-hidden="true"> · </span>
                정보 <b>{m.rule_score}</b>
              </span>
            </div>
            {m.photo_note && <p className="ai-box__note">{m.photo_note}</p>}
          </div>
        )}

        {(m.same.length > 0 || m.diff.length > 0) && (
          <ul className="reasons" aria-label="닮은 점과 다른 점">
            {m.same.map((s) => (
              <Reason key={`s-${s}`} kind="same" text={reword(s)} />
            ))}
            {m.diff.map((s) => (
              <Reason key={`d-${s}`} kind="diff" text={reword(s)} />
            ))}
          </ul>
        )}

        <div className={`match__actions ${isSighting || !m.care_tel ? 'is-single' : ''}`}>
          {!isSighting && m.care_tel && demo && (
            // 체험 중에는 전화 링크 자체를 만들지 않아요 (길게 눌러도 걸리지 않게)
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => toast('체험 중에는 실제 보호소로 전화가 걸리지 않게 막아 뒀어요.')}
            >
              <span aria-hidden="true">📞</span> 보호소 전화 (체험 중 막힘)
            </button>
          )}
          {!isSighting && m.care_tel && !demo && (
            <a className="btn btn--primary btn--sm" href={`tel:${m.care_tel.replace(/[^\d+]/g, '')}`} onClick={callShelter}>
              <span aria-hidden="true">📞</span> 보호소 전화
            </a>
          )}
          <button type="button" className="btn btn--ghost btn--sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? '접기' : '자세히'}
          </button>
        </div>

        {open && (
          <dl className="details">
            {m.special && (
              <>
                <dt>{isSighting ? '눈에 띈 점' : '특징'}</dt>
                <dd>{m.special}</dd>
              </>
            )}
            {isSighting ? (
              <>
                <dt>본 곳</dt>
                <dd>{m.place || '-'}</dd>
                <dt>본 날</dt>
                <dd>{monthDay(m.date)}</dd>
                <dt>안내</dt>
                <dd>보호소에 있는 아이가 아니에요. 제보된 장소 근처를 먼저 찾아보세요.</dd>
              </>
            ) : (
              <>
                {(m.age || m.weight) && (
                  <>
                    <dt>나이·체중</dt>
                    <dd>{joinDot([m.age, m.weight])}</dd>
                  </>
                )}
                {m.notice_no && (
                  <>
                    <dt>공고번호</dt>
                    <dd>{m.notice_no}</dd>
                  </>
                )}
                {m.notice_sdt && (
                  <>
                    <dt>공고 기간</dt>
                    <dd>
                      {monthDay(m.notice_sdt)} ~ {monthDay(m.notice_edt)}
                    </dd>
                  </>
                )}
                {m.care_name && (
                  <>
                    <dt>보호소</dt>
                    <dd>
                      {m.care_name}
                      {m.care_tel && !demo && <br />}
                      {!demo && m.care_tel}
                      {m.care_addr && <br />}
                      {m.care_addr}
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>
        )}
      </div>
    </article>
  );
}
