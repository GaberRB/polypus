# Chrome Web Store — Guia de Publicação

## Pré-requisitos

1. Conta de desenvolvedor na [Chrome Web Store](https://chrome.google.com/webstore/devconsole) (US$5, taxa única)
2. A extensão buildada e funcionando localmente

## Passo a passo

### 1. Build e empacotamento

```bash
cd apps/chrome
npm run build
npm run package-zip
```

Isso gera `polypus-chrome.zip` na raiz do projeto.

### 2. Envio para a loja

1. Acesse [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Clique **"New item"**
3. Faça upload do `polypus-chrome.zip`
4. Preencha os campos:

| Campo | Valor |
|-------|-------|
| **Name** | Polypus Web Agent |
| **Description (en)** | AI agent that acts inside your browser. Research docs, fill forms, manage repos — with any AI model, your own key. Open source. |
| **Description (pt-BR)** | Agente de IA que age dentro do seu navegador. Pesquise docs, preencha formulários, gerencie repositórios — com qualquer modelo de IA, sua própria chave. Open source. |
| **Category** | Developer Tools |
| **Language** | English (also supports Portuguese) |
| **Homepage URL** | https://gaberrb.github.io/polypus/chrome.html |

### 3. Imagens da loja

Prepare (opcional, mas recomendado):

- **Ícone 128x128** — o `icons/128.png` existente
- **Screenshots** (1280x800 ou 640x400) — mostrando o popup e side panel em ação
- **Promo image** (440x280) — banner pequeno
- **Marquee** (1400x560) — banner grande (opcional)

### 4. Permissões

O manifesto pede:
- `activeTab` — agir na aba ativa
- `scripting` — injetar content script
- `storage` — persistir sessão e configurações
- `sidePanel` — painel lateral
- `host_permissions: http://localhost/*` — WebSocket local com o CLI

A descrição deve deixar claro **por que** cada permissão é necessária.

### 5. Privacidade

A extensão **não coleta dados**. Na seção de privacidade do dashboard:

- **No remote code**: ✅ Não executa código remoto
- **No data collection**: ✅ Não coleta dados do usuário
- **Uses local WebSocket only**: conexão com `127.0.0.1:9876`

### 6. Atualizações

```bash
cd apps/chrome
# puxe as mudanças mais recentes do repo
git pull
# atualize a versão no manifest.json
# rode build e empacote
npm run build
npm run package-zip
```

Faça upload do novo ZIP no dashboard da Chrome Web Store.

## Checklist de publicação

- [ ] Build passa (`npm run typecheck && npm run build && npm test`)
- [ ] Conta de desenvolvedor criada (US$5)
- [ ] ZIP gerado com `npm run package-zip`
- [ ] Descrições em EN e PT-BR
- [ ] Justificativa de permissões documentada
- [ ] Política de privacidade: "sem coleta de dados"
- [ ] Screenshots da UI preparados
- [ ] Fazer upload → "Submit for review"
