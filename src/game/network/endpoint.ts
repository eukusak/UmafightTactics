/** A single endpoint policy for initial connections and seat recovery. */
export function multiplayerUrl(configured: string | undefined, page: { protocol: string; host: string; hostname: string }): string {
  if (configured?.trim()) {
    const url = new URL(configured.trim());
    if (!['ws:', 'wss:'].includes(url.protocol) || url.pathname !== '/multiplayer' || url.username || url.password || url.search || url.hash)
      throw new Error('VITE_MULTIPLAYER_URL은 /multiplayer 경로의 ws 또는 wss 주소여야 합니다.');
    if (page.protocol === 'https:' && url.protocol !== 'wss:') throw new Error('HTTPS 게임은 보안 연결(wss)이 필요합니다.');
    return url.href;
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(page.hostname))
    throw new Error('멀티플레이 서버 주소가 설정되지 않았습니다. VITE_MULTIPLAYER_URL 설정 후 사이트를 다시 빌드해 주세요.');
  return `${page.protocol === 'https:' ? 'wss:' : 'ws:'}//${page.host}/multiplayer`;
}
