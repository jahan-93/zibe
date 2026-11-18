import { useEffect } from 'react';
import { Footer, Header } from './components/Chrome';
import { Toaster } from './components/Toast';
import { useRoute } from './lib/router';
import { HomePage } from './pages/HomePage';
import { LostPage } from './pages/LostPage';
import { ReportPage } from './pages/ReportPage';
import { SightingPage } from './pages/SightingPage';
import { ThanksPage } from './pages/ThanksPage';

const TITLES = {
  home: '집으로 · 잃어버린 반려동물 찾기',
  lost: '잃어버린 아이 등록 · 집으로',
  seen: '길에서 본 아이 제보 · 집으로',
  thanks: '제보 고마워요 · 집으로',
  report: '내 등록 · 집으로',
} as const;

export function App() {
  const { route, key } = useRoute();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = TITLES[route.name];
  }, [key, route.name]);

  return (
    <div className="app">
      <Header />
      <main className="page" key={key}>
        {route.name === 'home' && <HomePage />}
        {route.name === 'lost' && <LostPage />}
        {route.name === 'seen' && <SightingPage />}
        {route.name === 'thanks' && <ThanksPage />}
        {route.name === 'report' && <ReportPage id={route.id} token={route.token} />}
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
