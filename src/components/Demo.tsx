// 체험(심사·데모) 모드: 지금 보호소에 있는 실제 아이를 예시로 골라 전 과정을 해 볼 수 있어요.
import { useEffect, useRef, useState } from 'react';
import { getDemoCases, type DemoCase } from '../api';
import { joinDot, monthDay, sexLabel, speciesLabel } from '../lib/format';
import { PetArt } from './PetArt';

export function DemoTag() {
  return <span className="demo-tag">체험용</span>;
}

function shortSido(sido: string) {
  return sido.replace(/(특별자치시|특별자치도|특별시|광역시)$/u, '');
}

function DemoPhoto({ c, purpose }: { c: DemoCase; purpose: 'lost' | 'seen' }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <PetArt species={c.species} color={c.color} />;
  return (
    <img
      src={purpose === 'lost' ? c.photo_owner : c.photo_found}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

function DemoPicker({
  purpose,
  highlightId,
  onPick,
}: {
  purpose: 'lost' | 'seen';
  highlightId?: string | null;
  onPick: (c: DemoCase) => void;
}) {
  const [cases, setCases] = useState<DemoCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setCases(null);
    setError(null);
    getDemoCases(highlightId)
      .then((r) => alive && setCases(r.cases))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [attempt, highlightId]);

  if (error) {
    return (
      <div className="demo__error">
        <p className="field__error">예시를 불러오지 못했어요. {error}</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAttempt((a) => a + 1)}>
          다시 불러오기
        </button>
      </div>
    );
  }
  if (!cases) {
    return (
      <div className="demo-grid" aria-busy="true" aria-label="예시를 불러오는 중">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="demo-card skeleton" style={{ height: 168 }} />
        ))}
      </div>
    );
  }
  if (!cases.length) {
    return (
      <div className="demo__error">
        <p className="field__hint">지금은 고를 수 있는 예시가 없어요. 잠시 뒤 다시 해 주세요.</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAttempt((a) => a + 1)}>
          다시 불러오기
        </button>
      </div>
    );
  }

  // 목격 체험은 ① 체험에서 고른 아이를 맨 앞에 (서버가 include로 넣어 줘요)
  const list = highlightId ? [...cases].sort((a, b) => Number(b.id === highlightId) - Number(a.id === highlightId)) : cases;
  return (
    <div className="demo-grid">
      {list.map((c) => (
        <button key={c.id} type="button" className={`demo-card ${c.id === highlightId ? 'is-hl' : ''}`} onClick={() => onPick(c)}>
          <span className="demo-card__photo">
            <DemoPhoto c={c} purpose={purpose} />
            {c.id === highlightId && <span className="demo-card__hl">① 체험에서 고른 아이</span>}
          </span>
          <span className="demo-card__title">{joinDot([speciesLabel(c.species), c.kind_name])}</span>
          <span className="demo-card__meta">{joinDot([c.color, sexLabel(c.sex)])}</span>
          <span className="demo-card__meta">
            {shortSido(c.sido)} {c.sigungu ?? ''} · {monthDay(c.rescued_date)} 구조
          </span>
        </button>
      ))}
    </div>
  );
}

export function DemoPanel({
  purpose,
  autoOpen,
  picked,
  onPick,
  onClear,
  highlightId,
}: {
  purpose: 'lost' | 'seen';
  autoOpen?: boolean;
  picked: DemoCase | null;
  onPick: (c: DemoCase) => void;
  onClear: () => void;
  highlightId?: string | null;
}) {
  const [open, setOpen] = useState(!!autoOpen);
  const pickedRef = useRef<HTMLDivElement>(null);

  // 고르고 나면 고른 결과로 초점을 옮겨서 화면 읽기 프로그램에도 알려 줘요
  useEffect(() => {
    if (picked) pickedRef.current?.focus();
  }, [picked]);

  return (
    <section className="demo" aria-label="체험용 예시">
      <div className="demo__head">
        <DemoTag />
        <b>{purpose === 'lost' ? '잃어버린 아이 사진이 없어도 체험할 수 있어요' : '길에서 본 아이가 없어도 체험할 수 있어요'}</b>
      </div>
      <p className="demo__body">
        {purpose === 'lost'
          ? '지금 실제 보호소에 있는 아이 한 마리를 "내가 잃어버린 아이"라고 가정해요. 그 아이의 다른 사진으로 등록하면, 전국 공고 중에서 같은 아이를 찾아내는지 볼 수 있어요.'
          : '보호소 공고 사진을 "길에서 찍은 사진"처럼 써서 제보해요. ① 잃어버렸어요 체험에서 고른 아이를 고르면, 그 체험 등록에 후보로 연결되는 걸 볼 수 있어요.'}
      </p>

      {picked ? (
        <div className="demo__picked" ref={pickedRef} tabIndex={-1} role="status">
          <span>
            ✓ <b>{joinDot([picked.kind_name, picked.color])}</b> 예시를 골랐어요. 아래 칸을 채워 뒀어요.
          </span>
          <button type="button" className="btn-text is-muted" onClick={onClear}>
            체험 취소
          </button>
        </div>
      ) : open ? (
        <>
          <p className="demo__hint">한 마리를 골라 주세요</p>
          <DemoPicker
            purpose={purpose}
            highlightId={highlightId}
            onPick={(c) => {
              onPick(c);
              setOpen(false);
            }}
          />
        </>
      ) : (
        <button type="button" className="btn btn--demo btn--sm" onClick={() => setOpen(true)}>
          체험용 예시 고르기
        </button>
      )}
      <p className="demo__fine">체험 기록은 실제 보호자에게 보이지 않고, 보호소로 전화도 걸리지 않아요.</p>
    </section>
  );
}
