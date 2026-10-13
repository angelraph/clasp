/** The Clasp mark: a brass C closing around an ink tag. Inline so it inherits no fetch. */
export function Mark({ size = 28, onDark = false, className }: { size?: number; onDark?: boolean; className?: string }) {
  const tag = onDark ? "#F4F1EA" : "#141413";
  const slot = onDark ? "#141413" : "#F4F1EA";
  const check = onDark ? "#A67C52" : "#D9B98F";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <path
        d="M50 17.5 L32 7.5 L12.5 18.5 L12.5 45.5 L32 56.5 L50 46.5"
        stroke={onDark ? "#B88D61" : "#A67C52"}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M26.5 20 H37.5 Q40 20 40 22.5 V37.6 L32 42.6 L24 37.6 V22.5 Q24 20 26.5 20 Z" fill={tag} />
      <rect x="29" y="23.2" width="6" height="1.6" rx="0.8" fill={slot} />
      <path d="M27.6 31.2 L30.9 34.4 L36.6 28.2" stroke={check} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={size} onDark={onDark} />
      <span className={`font-serif font-semibold tracking-tight ${onDark ? "text-paper" : "text-ink-900"}`} style={{ fontSize: size * 0.82 }}>
        Clasp
      </span>
    </span>
  );
}
