export function PolypusMascot({ size = "lg" }: { size?: "lg" | "sm" }): JSX.Element {
  return (
    <span className={`polypus-vp polypus-vp-${size}`}>
      <span className="polypus-mover">
        <span className="polypus-squash">
          <span className="polypus-body">
            <span className="polypus-eye" />
            <span className="polypus-eye" />
          </span>
          <span className="polypus-legs">
            <span className="polypus-leg" />
            <span className="polypus-leg" />
            <span className="polypus-leg" />
            <span className="polypus-leg" />
          </span>
        </span>
      </span>
    </span>
  );
}
