import { useRef, useState } from 'react';
import { fileToJpeg } from '../lib/image';

export interface Photo {
  /** data:image/jpeg;base64,... 또는 (체험) 공고 사진 주소 */
  dataUrl: string;
  /** 사진 위에 작게 붙는 설명 (체험 사진 등) */
  caption?: string;
}

export function PhotoPicker({
  value,
  onChange,
  hint = '얼굴과 털 무늬가 잘 보이는 사진이 좋아요',
  invalid,
}: {
  value: Photo | null;
  onChange: (p: Photo | null) => void;
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
      onChange({ dataUrl: await fileToJpeg(file) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
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
            {value.caption && <span className="pet-art__label">{value.caption}</span>}
          </div>
          <div className="photo__actions">
            <button type="button" className="btn-text" onClick={pick}>
              {value.caption ? '내 사진으로 바꾸기' : '다른 사진 고르기'}
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
    </div>
  );
}
