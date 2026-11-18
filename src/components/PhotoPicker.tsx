import { useRef, useState } from 'react';
import type { Species } from '../api';
import { fileToJpeg, svgToJpeg } from '../lib/image';
import { ART_BACKGROUNDS, petSvg } from './PetArt';

export interface Photo {
  dataUrl: string;
  isExample: boolean;
}

export function PhotoPicker({
  value,
  onChange,
  species,
  color,
  hint = '얼굴과 털 무늬가 잘 보이는 사진이 좋아요',
  invalid,
}: {
  value: Photo | null;
  onChange: (p: Photo | null) => void;
  species: Species;
  color?: string;
  hint?: string;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => input.current?.click();

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange({ dataUrl: await fileToJpeg(file), isExample: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const useExample = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange({ dataUrl: await svgToJpeg(petSvg(species, color, ART_BACKGROUNDS[0])), isExample: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="photo__frame">
          <div className="photo__preview">
            <img src={value.dataUrl} alt="고른 사진" />
            {value.isExample && <span className="pet-art__label">사진 대신 그림</span>}
          </div>
          <div className="photo__actions">
            <button type="button" className="btn-text" onClick={pick}>
              다른 사진 고르기
            </button>
            <button type="button" className="btn-text is-muted" onClick={() => onChange(null)}>
              지우기
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={`photo__empty ${invalid ? 'is-invalid' : ''}`} onClick={pick} disabled={busy}>
          <span className="photo__icon" aria-hidden="true">
            📷
          </span>
          <span className="photo__title">{busy ? '사진 준비하는 중…' : '사진 고르기'}</span>
          <span className="photo__hint">{hint}</span>
        </button>
      )}
      {error && <p className="field__error">{error}</p>}
      {!value && (
        <button type="button" className="link-accent" onClick={useExample} disabled={busy}>
          사진이 없으면 예시 사진으로 해 보기
        </button>
      )}
    </div>
  );
}
