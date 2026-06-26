export function isDiff(output: string): boolean {
  return output.includes("@@") && (output.includes("---") || output.includes("+++"));
}

type LineClass = "add" | "del" | "hunk" | "meta" | "ctx";

function classify(line: string): LineClass {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "del";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("---") || line.startsWith("+++")) return "meta";
  return "ctx";
}

export function DiffViewer({ diff }: { diff: string }): JSX.Element {
  const lines = diff.split("\n");
  return (
    <div className="diff-viewer" role="region" aria-label="Alterações no arquivo">
      {lines.map((line, i) => {
        const cls = classify(line);
        return (
          <div key={i} className={`diff-line diff-line--${cls}`}>
            <span className="diff-gutter" aria-hidden>
              {cls === "add" ? "+" : cls === "del" ? "-" : " "}
            </span>
            <span className="diff-content">{line.slice(cls === "add" || cls === "del" ? 1 : 0)}</span>
          </div>
        );
      })}
    </div>
  );
}
