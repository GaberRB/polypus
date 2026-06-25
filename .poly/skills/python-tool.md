# skill: run_python_script (ler arquivos estruturados)

Como usar bem a tool `run_python_script`. Leia também [`coding.md`](coding.md).

## Quando usar

- Extrair **valores específicos** de arquivos estruturados (JSON, CSV, XML, SQLite) quando ler à mão
  linha a linha seria frágil ou caro em tokens.
- **Não** use para texto puro — prefira `read_file` (ou `read_file` com `start_line`/`end_line`).
- **Não** use para efeitos colaterais (escrever/apagar/baixar). Escrita é `write_file`/`edit_file`,
  remoção é `delete_file`, mover é `move_file`.

## Como usar bem

1. **Imprima só o necessário.** A saída é limitada (~20k chars) e clampada; não despeje o arquivo inteiro,
   `print` apenas os valores que você precisa.
2. **Caminhos relativos ao workspace.** O script roda com o workspace como cwd; abra `open("dados.json")`.
3. **Use a stdlib.** `json`, `csv`, `xml.etree`, `sqlite3` vêm com o Python. Formatos como YAML/`.xlsx`
   exigem pacotes externos (`pyyaml`, `openpyxl`); se faltar, a tool sugere `pip install <pkg>`.
4. **Sem loops infinitos.** Há timeout (`POLYPUS_PYTHON_TIMEOUT_MS`, default 120s) e cap de saída; um
   `while True: print(...)` é abortado.

## Exemplo

```python
import json
d = json.load(open("package.json"))
print(d["version"])
```

## Limites

- Roda Python arbitrário: é `mutating` e passa pelo modo de permissão (em `plan` é bloqueada; em `review`
  você confirma vendo o script). Não a use para burlar isso.
