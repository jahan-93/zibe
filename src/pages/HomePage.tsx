import { useState } from 'react';
import { PetArt } from '../components/PetArt';
import { monthDay, speciesLabel } from '../lib/format';
import { reportPath } from '../lib/router';
import { forgetReport, loadSaved } from '../lib/store';

export function HomePage() {
  const [saved, setSaved] = useState(loadSaved);

  return (
    <>
      <section className="hero">
        <div className="hero__art" aria-hidden="true">
          <PetArt species="dog" color="크림" bg="#FBE3D6" label={false} />
          <PetArt species="cat" color="치즈" bg="#DCEFE6" label={false} />
        </div>
        <h1 className="hero__title">
          잃어버린 아이,
          <br />
          <em>집으로</em> 데려와요
        </h1>
        <p className="hero__sub">
          전국 보호소의 구조 공고와 이웃의 목격 제보 중에서 닮은 아이를 찾아 드려요. 매일 아침 새 공고와 다시
          비교해요.
        </p>
      </section>

      <nav className="choices" aria-label="무엇을 할까요">
        <a href="#/lost" className="choice choice--primary">
          <span className="choice__icon" aria-hidden="true">
            🐾
          </span>
          <span className="choice__text">
            <b>아이를 잃어버렸어요</b>
            <span>사진과 잃어버린 곳만 알려 주세요 · 1분</span>
          </span>
          <span className="choice__arrow" aria-hidden="true">
            →
          </span>
        </a>
        <a href="#/seen" className="choice">
          <span className="choice__icon" aria-hidden="true">
            👀
          </span>
          <span className="choice__text">
            <b>길에서 아이를 봤어요</b>
            <span>찾고 있는 보호자에게 바로 알려요</span>
          </span>
          <span className="choice__arrow" aria-hidden="true">
            →
          </span>
        </a>
      </nav>

      {saved.length > 0 && (
        <section>
          <h2 className="section-title">내 등록</h2>
          <ul className="saved">
            {saved.map((s) => (
              <li key={s.id} className="saved__item">
                <span className="saved__icon" aria-hidden="true">
                  {s.species === 'cat' ? '🐱' : '🐶'}
                </span>
                <a className="saved__link" href={`#${reportPath(s.id, s.token)}`}>
                  <b>
                    {speciesLabel(s.species)}
                    {s.label ? ` · ${s.label}` : ''}
                  </b>
                  <span>
                    {monthDay(s.lost_date)} · {s.place}에서 잃어버림
                  </span>
                </a>
                <button
                  type="button"
                  className="saved__x"
                  aria-label="이 기기 목록에서 지우기"
                  title="이 기기 목록에서 지우기 (등록은 그대로 있어요)"
                  onClick={() => {
                    forgetReport(s.id);
                    setSaved(loadSaved());
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="fact">
        <div className="fact__badge" aria-hidden="true">
          D-10
        </div>
        <p>
          <b>하루라도 빨리 확인하세요.</b> 보호소 공고가 올라오고 10일이 지나도 보호자가 나타나지 않으면 소유권이
          지자체로 넘어갈 수 있어요.
        </p>
      </section>

      <section>
        <h2 className="section-title">이렇게 찾아요</h2>
        <ol className="steps">
          <li>
            <span className="steps__num">1</span>
            <div>
              <b>사진과 잃어버린 곳을 알려 주세요</b>
              <span>로그인 없이 1분이면 돼요.</span>
            </div>
          </li>
          <li>
            <span className="steps__num">2</span>
            <div>
              <b>구조 공고·목격 제보와 바로 비교해요</b>
              <span>털색·품종·성별·장소·날짜·특징이 얼마나 맞는지 순서대로 보여 드려요.</span>
            </div>
          </li>
          <li>
            <span className="steps__num">3</span>
            <div>
              <b>매일 아침 다시 찾아요</b>
              <span>새 공고가 올라오면 자동으로 비교해서 내 등록에 더해 둬요.</span>
            </div>
          </li>
        </ol>
      </section>
    </>
  );
}
