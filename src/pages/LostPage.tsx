import { useId, useRef, useState, type FormEvent } from 'react';
import { createReport, type Sex, type Species } from '../api';
import { BackLink } from '../components/Chrome';
import { Chips, Field, MultiChips, SidoSigungu } from '../components/Form';
import { PhotoPicker, type Photo } from '../components/PhotoPicker';
import { BREED_SUGGESTIONS, COLOR_OPTIONS, SEX_OPTIONS, SIDO_LIST, SPECIES_OPTIONS } from '../constants';
import { todayKST } from '../lib/format';
import { go, reportPath } from '../lib/router';
import { handOffReport, rememberReport } from '../lib/store';

export function LostPage() {
  const id = useId();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [species, setSpecies] = useState<Species>('dog');
  const [lostDate, setLostDate] = useState(todayKST);
  const [sido, setSido] = useState<string>(SIDO_LIST[0]);
  const [sigungu, setSigungu] = useState('');
  const [sex, setSex] = useState<Sex>('Q');
  const [colors, setColors] = useState<string[]>([]);
  const [breed, setBreed] = useState('');
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
    if (!photo) return fail('사진을 한 장 골라 주세요.');
    if (!lostDate) return fail('잃어버린 날을 골라 주세요.');
    if (lostDate > todayKST()) return fail('잃어버린 날이 오늘보다 뒤예요. 날짜를 다시 확인해 주세요.');

    setError(null);
    setBusy(true);
    try {
      const view = await createReport({
        species,
        lost_date: lostDate,
        sido,
        sigungu: sigungu.trim() || undefined,
        sex,
        color: colors.join(', ') || undefined,
        breed: breed.trim() || undefined,
        memo: memo.trim() || undefined,
        photo: photo.dataUrl,
      });
      rememberReport(view, view.token);
      handOffReport(view);
      go(reportPath(view.report.id, view.token));
    } catch (err) {
      fail((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <BackLink />
      <div className="page-head">
        <h1>잃어버린 아이를 알려 주세요</h1>
        <p>입력은 1분이면 돼요. 적을수록 후보가 넓어지고, 많이 적을수록 정확해져요.</p>
      </div>

      {error && (
        <div ref={errRef} className="form-error" role="alert">
          {error}
        </div>
      )}

      <form className="form" onSubmit={submit} noValidate>
        <Field label="사진">
          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            species={species}
            color={colors[0]}
            invalid={!!error && !photo}
          />
        </Field>

        <Field label="어떤 아이인가요?">
          <Chips label="종" options={SPECIES_OPTIONS} value={species} onChange={setSpecies} />
        </Field>

        <Field label="잃어버린 날" htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            className="input"
            type="date"
            value={lostDate}
            max={todayKST()}
            onChange={(e) => setLostDate(e.target.value)}
            required
          />
        </Field>

        <Field label="잃어버린 곳">
          <SidoSigungu sido={sido} sigungu={sigungu} onSido={setSido} onSigungu={setSigungu} options={SIDO_LIST} />
        </Field>

        <Field label="성별">
          <Chips label="성별" options={SEX_OPTIONS} value={sex} onChange={setSex} />
        </Field>

        <Field label="털색" optional hint="여러 색이면 두세 개 골라도 돼요">
          <MultiChips label="털색" options={COLOR_OPTIONS} value={colors} onChange={setColors} />
        </Field>

        <Field label="품종" optional htmlFor={`${id}-breed`}>
          <input
            id={`${id}-breed`}
            className="input"
            list={`${id}-breeds`}
            value={breed}
            maxLength={60}
            placeholder={species === 'cat' ? '예: 코리안숏헤어' : '예: 말티즈, 믹스견'}
            onChange={(e) => setBreed(e.target.value)}
          />
          <datalist id={`${id}-breeds`}>
            {BREED_SUGGESTIONS[species].map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>

        <Field label="특징" optional htmlFor={`${id}-memo`}>
          <textarea
            id={`${id}-memo`}
            className="input"
            rows={3}
            maxLength={300}
            value={memo}
            placeholder="예: 분홍 목줄, 왼쪽 귀 끝 갈색 얼룩, 사람을 잘 따름"
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>

        <div className="submit">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> 공고와 사진을 비교하는 중… (최대 30초)
              </>
            ) : (
              '닮은 아이 찾기'
            )}
          </button>
          <p className="submit__note">로그인은 필요 없어요. 등록하면 다시 볼 수 있는 링크를 드려요.</p>
        </div>
      </form>
    </>
  );
}
