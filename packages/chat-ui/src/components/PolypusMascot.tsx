/**
 * The Polypus mascot — an octopus (poly-pus), NOT a generic Space-Invaders
 * alien. Ported verbatim from the desktop app so both shells share one identity.
 * Pure SVG; color comes from `currentColor` and states drive CSS animation.
 */
export function PolypusMascot({
  size = "lg",
  state = "idle",
}: {
  size?: "lg" | "sm";
  state?: "idle" | "running" | "success" | "error";
}): JSX.Element {
  return (
    <span className={`polypus-vp polypus-vp-${size}`}>
      <svg
        className={`polypus-mascot polypus-mascot--${state}`}
        viewBox="0 0 80 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Blush ovals — cheek warmth */}
        <ellipse cx="22" cy="36" rx="7" ry="3.5" fill="white" fillOpacity="0.08" />
        <ellipse cx="58" cy="36" rx="7" ry="3.5" fill="white" fillOpacity="0.08" />

        {/* Mantle body — dome top, organic bottom */}
        <path
          d="M12,34 C12,10 68,10 68,34 C68,50 56,54 40,54 C24,54 12,50 12,34 Z"
          fill="currentColor"
        />

        {/* Left eye */}
        <circle cx="28" cy="28" r="7.5" fill="white" />
        <circle cx="30" cy="30" r="4.5" fill="#1a0d4d" />
        <circle cx="32" cy="27" r="1.3" fill="white" />

        {/* Right eye */}
        <circle cx="52" cy="28" r="7.5" fill="white" />
        <circle cx="54" cy="30" r="4.5" fill="#1a0d4d" />
        <circle cx="56" cy="27" r="1.3" fill="white" />

        {/* Smile */}
        <path
          d="M33,38 Q40,44 47,38"
          stroke="white"
          strokeOpacity="0.6"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* 8 tentacles — outer ones curve wide, inner ones go nearly straight */}
        <path className="polypus-t1" d="M22,52 C16,63 8,72 10,86" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path className="polypus-t2" d="M28,53 C24,64 20,73 22,87" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path className="polypus-t3" d="M33,54 C31,65 28,74 30,87" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path className="polypus-t4" d="M38,54 C37,65 35,74 36,88" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path className="polypus-t5" d="M42,54 C43,65 45,74 44,88" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path className="polypus-t6" d="M47,54 C49,65 52,74 50,87" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path className="polypus-t7" d="M52,53 C56,64 60,73 58,87" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path className="polypus-t8" d="M58,52 C64,63 72,72 70,86" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
