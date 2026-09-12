import { useEffect, useRef, useState } from 'react';
import { loadDecodedImage } from '../game/ui/load-image';

/** Keep the last decoded field until its replacement is ready, never an empty flash. */
export function ArenaImage({ url, fallback }: { url: string; fallback: string }): JSX.Element {
  const [source, setSource] = useState<string | null>(null);
  const shown = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let primaryReady = false;
    setFailed(false);
    const display = (src: string) => { shown.current = src; setSource(src); };
    void loadDecodedImage(url, controller.signal).then(src => {
      if (!controller.signal.aborted) { primaryReady = true; display(src); }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    if (!shown.current && fallback !== url) {
      void loadDecodedImage(fallback, controller.signal).then(src => {
        if (!controller.signal.aborted && !primaryReady) display(src);
      }).catch(() => { /* A readable field color stays behind both requests. */ });
    }
    return () => controller.abort();
  }, [url, fallback, retry]);
  return <>
    {source && <img className="arena-background-image" src={source} alt="" draggable={false} />}
    {failed && <button className="arena-image-retry" onClick={() => setRetry(n => n + 1)}>경기장 이미지 다시 불러오기</button>}
  </>;
}
