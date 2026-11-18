import { useId, useRef, useState, type FormEvent } from 'react';
import { createSighting, type Species } from '../api';
import { Callout } from '../components/Callouts';
import { BackLink } from '../components/Chrome';
import { Chips, Field, MultiChips, SidoSigungu } from '../components/Form';
import { PhotoPicker, type Photo } from '../components/PhotoPicker';
import { COLOR_OPTIONS, SIDO_LIST, SPECIES_OPTIONS } from '../constants';
import { todayKST } from '../lib/format';
import { go } from '../lib/router';
import { handOffSighting } from '../lib/store';

export function SightingPage() {
  const id = useId();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [species, setSpecies] = useState<Species>('dog');
  const [seenDate, setSeenDate] = useState(todayKST);
  const [sido, setSido] = useState<string>(SIDO_LIST[0]);
  const [sigungu, setSigungu] = useState('');
  const [place, setPlace] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);

  const fail = (msg: string) => {
    setError(msg);
    requestAnimationFrame(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!photo) return fail('사진을 한 장 올려 주세요. 멀리서 찍은 사진도 괜찮아요.');
    if (!seenDate) return fail('본 날을 골라 주세요.');
    if (seenDate > todayKST()) return fail('본 날이 오늘보다 뒤예요. 날짜를 다시 확인해 주세요.');

    setError(null);
    setBusy(true);
    try {
      const res = await createSighting({
        species,
        seen_date: seenDate,
        sido,
        sigungu: sigungu.trim() || undefined,
        place: place.trim() || undefined,
        color: colors.join(', ') || undefined,
        memo: memo.trim() || undefined,
        photo: photo.dataUrl,
      });
      handOffSighting(res);
      go('/seen/thanks');
    } catch (err) {
      fail((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <BackLink />
      <div className="page-head">
        <h1>길에서 본 아이를 알려 주세요</h1>
        <p>찾고 있는 보호자들과 바로 비교해요. 보호자에게는 사진·장소·날짜만 보여 줘요.</p>
      </div>

      {error && (
        <div ref={errRef} className="form-error" role="alert">
          {error}
        </div>
      )}

      <form className="form" onSubmit={submit} noValidate>
        <Field label="사진 (멀리서 찍어도 괜찮아요)">
          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            species={species}
            color={colors[0]}
            hint="흐려도 괜찮아요. 털색과 모습이 보이면 돼요"
            invalid={!!error && !photo}
          />
        </Field>

        <Field label="어떤 아이였나요?">
          <Chips label="종" options={SPECIES_OPTIONS} value={species} onChange={setSpecies} />
        </Field>

        <Field label="본 날" htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            className="input"
            type="date"
            value={seenDate}
            max={todayKST()}
            onChange={(e) => setSeenDate(e.target.value)}
            required
          />
        </Field>

        <Field label="본 곳">
          <SidoSigungu sido={sido} sigungu={sigungu} onSido={setSido} onSigungu={setSigungu} options={SIDO_LIST} />
        </Field>

        <Field label="자세한 장소" optional htmlFor={`${id}-place`}>
          <input
            id={`${id}-place`}
            className="input"
            value={place}
            maxLength={100}
            placeholder="예: 망원시장 입구"
            onChange={(e) => setPlace(e.target.value)}
          />
        </Field>

        <Field label="털색">
          <MultiChips label="털색" options={COLOR_OPTIONS} value={colors} onChange={setColors} />
        </Field>

        <Field label="눈에 띈 점" optional htmlFor={`${id}-memo`}>
          <textarea
            id={`${id}-memo`}
            className="input"
            rows={3}
            maxLength={300}
            value={memo}
            placeholder="예: 분홍 목줄, 다리를 조금 절었어요"
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>

        <Callout tone="danger" icon="🙏">
          겁먹은 아이는 쫓아가면 더 멀리 도망가요. 무리해서 잡지 말고 사진과 장소만 알려 주세요.
        </Callout>

        <div className="submit">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> 보호자들과 비교하는 중…
              </>
            ) : (
              '제보하기'
            )}
          </button>
        </div>
      </form>
    </>
  );
}
