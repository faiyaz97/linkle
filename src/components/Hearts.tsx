'use client';
type Props = { lives: number; pulse?: boolean };
const Heart = ({ full }: { full: boolean }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" className={full ? "text-red-500" : "text-gray-300"} fill="currentColor">
    {full ? (
      <path d="M12 21s-6.148-3.392-9.192-6.436C.82 12.576.82 9.424 2.808 7.436a5.5 5.5 0 0 1 7.778 0L12 8.85l1.414-1.414a5.5 5.5 0 0 1 7.778 7.778C18.148 17.608 12 21 12 21z"/>
    ) : (
      <path d="M12 21s-6.148-3.392-9.192-6.436C.82 12.576.82 9.424 2.808 7.436a5.5 5.5 0 0 1 7.778 0L12 8.85l1.414-1.414a5.5 5.5 0 1 1 7.778 7.778C18.148 17.608 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth="2"/>
    )}
  </svg>
);
export default function Hearts({ lives, pulse }: Props) {
  return (
    <div className={`flex gap-2 ${pulse ? "animate-pop" : ""}`}>
      <Heart full={lives>=1} />
      <Heart full={lives>=2} />
      <Heart full={lives>=3} />
    </div>
  );
}