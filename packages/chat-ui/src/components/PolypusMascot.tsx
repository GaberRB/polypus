/**
 * The Polypus mascot — the official pixel-art octopus (logo.png), inlined as a
 * data URI so it ships in any bundle with no asset-path plumbing. `state` drives
 * a subtle animation; pixel art is kept crisp via image-rendering: pixelated.
 */
import { LOGO_DATA_URI } from "../assets/logo-data.js";

export function PolypusMascot({
  size = "lg",
  state = "idle",
}: {
  size?: "lg" | "sm";
  state?: "idle" | "running" | "success" | "error";
}): JSX.Element {
  return (
    <span className={`polypus-vp polypus-vp-${size}`}>
      <img
        className={`polypus-mascot polypus-mascot--${state}`}
        src={LOGO_DATA_URI}
        alt="Polypus"
        width={size === "lg" ? 72 : 28}
        height={size === "lg" ? 72 : 28}
      />
    </span>
  );
}
