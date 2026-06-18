# Bug: Versão do banner CLI não corresponde à versão do `polypus --version`

## Descrição
O banner exibido ao iniciar o Polypus mostra uma versão hardcoded `v0.1.0`, enquanto o comando `polypus --version` retorna a versão correta do `package.json` (atualmente `0.3.0`).

## Localização do Bug
Arquivo: `src/ui/banner.ts`, linha ~123:
```typescript
const tagline = (): string => c1(t("welcome.tagline")) + pc.dim("   v0.1.0");
```

## Comportamento Esperado
O banner deve exibir a mesma versão que `polypus --version`, lendo dinamicamente do `package.json`.

## Comportamento Atual
- Banner: `v0.1.0` (hardcoded)
- `polypus --version`: `0.3.0` (lido do package.json)

## Solução Proposta
1. Exportar a versão do package.json de `src/cli/index.ts` (já existe como `pkgVersion`)
2. Passar a versão para a função `banner()` ou torná-la acessível globalmente
3. Atualizar a função `tagline()` para usar a versão dinâmica

## Exemplo de Correção
```typescript
// Em src/cli/index.ts - já existe:
const { version: pkgVersion } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

// Em src/ui/banner.ts - modificar para aceitar versão:
export function banner(version?: string): string {
  const ver = version ?? "0.1.0"; // fallback
  const tagline = (): string => c1(t("welcome.tagline")) + pc.dim(`   v${ver}`);
  // ...
}
```

## Prioridade
Média - Afeta apenas a exibição visual, não a funcionalidade.