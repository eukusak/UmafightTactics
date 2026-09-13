/** Break prose at sentence/newline boundaries without changing values or rules. */
export function EffectDescription({ text }: { text: string }): JSX.Element {
  const sentences = text.split(/\n+|(?<=[.!?])\s+/u).map(line => line.trim()).filter(Boolean);
  return <span className="effect-copy">{sentences.map((sentence, i) => <span className="effect-sentence" key={i}>{sentence}{i < sentences.length - 1 ? ' ' : ''}</span>)}</span>;
}
