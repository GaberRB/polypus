"""Tokens/custo do opencode por tarefa (o `run` headless não imprime; leem do SQLite).
Uso: python collect-oc-tokens.py <stamp>   ex.: python collect-oc-tokens.py 20260701-2045
Casa as sessões cujo diretório contém <stamp>-opencode."""
import sqlite3, os, sys

stamp = sys.argv[1] if len(sys.argv) > 1 else ""
db = os.path.expanduser("~/.local/share/opencode/opencode.db")
con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
rows = con.execute(
    "SELECT directory, cost, tokens_input, tokens_output FROM session "
    "WHERE directory LIKE ? ORDER BY time_created", (f"%{stamp}-opencode%",)
).fetchall()
print(f"{'task':14} {'cost_usd':>10} {'tokens_in':>10} {'tokens_out':>10}")
for d, cost, ti, to in rows:
    task = os.path.basename(d.rstrip("/"))
    print(f"{task:14} {round(cost or 0,5):>10} {ti or 0:>10} {to or 0:>10}")
