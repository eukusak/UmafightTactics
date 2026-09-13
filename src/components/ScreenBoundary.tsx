import { Component, type ReactNode } from 'react';
/** A replaced CDN chunk must yield a recovery action, not a blank application. */
export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  override render(): ReactNode {
    if (this.state.failed) return <div className="screen-loading" role="alert"><div><p>화면을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 열어 주세요.</p><button onClick={() => location.reload()}>새로고침</button></div></div>;
    return this.props.children;
  }
}
