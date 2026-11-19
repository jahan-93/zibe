import { useEffect, useState } from 'react';

// 서버 설정 없이 어디에 올려도 되도록 해시 주소를 써요.
//   #/            처음
//   #/lost        잃어버렸어요        (#/lost/demo: 체험 예시 고르기 열린 채로)
//   #/seen        길에서 봤어요        (#/seen/demo: 체험 예시 고르기 열린 채로)
//   #/seen/thanks 제보 고마워요
//   #/r/:id/:tok  내 등록
export type Route =
  | { name: 'home' }
  | { name: 'lost'; demo: boolean }
  | { name: 'seen'; demo: boolean }
  | { name: 'thanks' }
  | { name: 'report'; id: string; token: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  if (parts[0] === 'lost') return { name: 'lost', demo: parts[1] === 'demo' };
  if (parts[0] === 'seen') return parts[1] === 'thanks' ? { name: 'thanks' } : { name: 'seen', demo: parts[1] === 'demo' };
  if (parts[0] === 'r' && parts[1] && parts[2]) return { name: 'report', id: parts[1], token: parts[2] };
  return { name: 'home' };
}

export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return { route: parseRoute(hash), key: hash };
}

export function go(path: string) {
  window.location.hash = path;
}

export function reportPath(id: string, token: string) {
  return `/r/${encodeURIComponent(id)}/${encodeURIComponent(token)}`;
}

export function reportLink(id: string, token: string) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${reportPath(id, token)}`;
}
