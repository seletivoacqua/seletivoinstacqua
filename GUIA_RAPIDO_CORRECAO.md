# 🚀 Guia Rápido - Correção de Erros

## ⚡ 3 Passos Rápidos

### 1️⃣ NOVO SCRIPT (5 min)

```
1. Abrir Google Sheets
2. Extensões > Apps Script
3. DELETE TODO o código
4. Copiar: google-apps-script-final-corrigido.js
5. Colar e Salvar (Ctrl+S)
6. Implantar > Nova implantação
   - Tipo: Aplicativo da Web
   - Executar como: Eu
   - Acesso: Qualquer pessoa
7. COPIAR URL
```

---

### 2️⃣ ATUALIZAR .ENV (1 min)

```env
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/SUA_NOVA_URL/exec
```

**Substituir pela URL copiada!**

---

### 3️⃣ BUILD E DEPLOY (2 min)

```bash
npm run build
git add .
git commit -m "fix: Corrigir CORS e envio de mensagens"
git push
```

**Se usar Netlify:**
- Atualizar variável `VITE_GOOGLE_SCRIPT_URL`
- Redesenhar site (Clear cache)

---

## ✅ Testar

Abra no navegador:
```
https://script.google.com/macros/s/SUA_URL/exec?action=test
```

**Deve retornar:**
```json
{"success":true,"data":{"status":"OK",...}}
```

---

## 🔧 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `google-apps-script-final-corrigido.js` | ✅ **USE ESTE!** Script corrigido |
| `SOLUCAO_DEFINITIVA_ERROS.md` | Guia completo passo a passo |
| `PASSO_A_PASSO_CONFIGURACAO.md` | Configuração do zero |

---

## ❌ Problemas Resolvidos

✅ **CORS bloqueado** → Headers CORS corrigidos
✅ **Failed to fetch** → Nova implantação
✅ **sendMessages not a function** → Função adicionada
✅ **URL antiga** → Nova URL necessária

---

## 🆘 Ainda com erro?

### Erro de CORS?
```
Verifique: Implantação > Quem tem acesso: Qualquer pessoa
```

### URL não funciona?
```
Teste direto: SUA_URL?action=test
Se não retornar JSON → URL errada
```

### Build com erro?
```bash
npm install
npm run build
```

---

## 📋 Checklist Mínimo

- [ ] Script novo colado
- [ ] Nova implantação criada
- [ ] URL copiada e colada no .env
- [ ] Build executado
- [ ] URL testada no navegador
- [ ] Deploy feito

**Tempo total: ~10 minutos**

---

## 🎯 Status

✅ Build: **Sucesso** (6.71s)
✅ Código: **Corrigido**
✅ Documentação: **Completa**

**Pronto para usar!**
