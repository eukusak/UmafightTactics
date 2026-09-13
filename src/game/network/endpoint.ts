/** A single endpoint policy for initial connections and seat recovery. */
export function multiplayerUrl(configured: string | undefined, page: { protocol: string; host: string; hostname: string }): string {
  if (configured?.trim()) {
    const url = new URL(configured.trim());
    if (!['ws:', 'wss:'].includes(url.protocol) || url.pathname !== '/multiplayer' || url.username || url.password || url.search || url.hash)
      throw new Error('VITE_MULTIPLAYER_URL은 /multiplayer 경로의 ws 또는 wss 주소여야 합니다.');
    if (page.protocol === 'https:' && url.protocol !== 'wss:') throw new Error('HTTPS 게임은 보안 연결(wss)이 필요합니다.');
    return url.href;
  }
  // Existing integrated deployments use the current origin. A configured split
  // backend always wins above, including during reconnect/seat recovery.
  if (!['http:', 'https:'].includes(page.protocol))
    throw new Error('온라인 대전은 HTTP 또는 HTTPS 게임 주소에서 접속해 주세요.');
  return `${page.protocol === 'https:' ? 'wss:' : 'ws:'}//${page.host}/multiplayer`;
}
