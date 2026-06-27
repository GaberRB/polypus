/**
 * The Polypus mascot — the kawaii octopus from the CLI banner: violet gradient
 * mantle, round glasses with white lenses, a little smile, rosy cheeks and eight
 * chubby tentacles. Pure SVG so it stays razor-crisp at any size (the old 128px
 * PNG looked rough when scaled up). `state` drives a subtle animation.
 */
export function PolypusMascot({
  size = "lg",
  state = "idle",
}: {
  size?: "lg" | "sm";
  state?: "idle" | "running" | "success" | "error";
}): JSX.Element {
  const px = size === "lg" ? 76 : 30;
  // Unique gradient id per size so two instances don't collide in one document.
  const gid = `poly-grad-${size}`;
  return (
    <span className={`polypus-vp polypus-vp-${size}`}>
      <svg
        className={`polypus-mascot polypus-mascot--${state}`}
        width={px}
        height={px}
        viewBox="0 0 80 86"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Polypus"
        role="img"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdb6fd" />
            <stop offset="0.55" stopColor="#9d6cf2" />
            <stop offset="1" stopColor="#7a4ade" />
          </linearGradient>
        </defs>

        {/* Eight chubby tentacles, drawn first so the body overlaps their tops */}
        <g fill={`url(#${gid})`}>
          <path d="M16 46c-3 0-5 2-5 6 0 5 1 9 3 12 1 2 4 1 4-1 0-3-1-6-1-9 1-3 2-8-1-8Z" />
          <path d="M25 50c-3 0-4 3-4 7 0 4 0 8 1 11 1 2 4 2 4 0 0-3-1-7-1-10 0-3 2-8 0-8Z" />
          <path d="M34 52c-2 0-3 3-3 7s0 8 1 11c0 2 3 2 3 0 0-3 0-7 0-10s1-8-1-8Z" />
          <path d="M43 52c-2 0-1 5-1 8s0 7 0 10c0 2 3 2 3 0 1-3 1-7 1-11s1-7-3-7Z" />
          <path d="M52 50c-2 0-1 5-1 8 0 3-1 7-1 10 0 2 3 2 4 0 1-3 1-7 1-11 0-4-1-7-3-7Z" />
          <path d="M61 46c-3 0-2 5-1 8 0 3-1 6-1 9 0 2 3 3 4 1 2-3 3-7 3-12 0-4-2-6-5-6Z" />
        </g>

        {/* Mantle / head */}
        <path
          d="M40 6C22 6 11 17 11 33c0 12 9 19 29 19s29-7 29-19C69 17 58 6 40 6Z"
          fill={`url(#${gid})`}
        />

        {/* Rosy cheeks */}
        <ellipse cx="20" cy="36" rx="6" ry="3.4" fill="#ff8abe" fillOpacity="0.55" />
        <ellipse cx="60" cy="36" rx="6" ry="3.4" fill="#ff8abe" fillOpacity="0.55" />

        {/* Round glasses: bridge + two lenses */}
        <path d="M38 27h4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <g>
          <circle cx="29" cy="27" r="9" fill="#fff" />
          <circle cx="51" cy="27" r="9" fill="#fff" />
          <circle cx="29" cy="27" r="9" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" />
          <circle cx="51" cy="27" r="9" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" />
          {/* Pupils + glints */}
          <circle cx="30" cy="28" r="4.4" fill="#3a1d7a" />
          <circle cx="52" cy="28" r="4.4" fill="#3a1d7a" />
          <circle cx="31.6" cy="26.4" r="1.4" fill="#fff" />
          <circle cx="53.6" cy="26.4" r="1.4" fill="#fff" />
        </g>

        {/* Smile */}
        <path d="M34 39q6 5 12 0" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}
