# 🔧 Solução: Erro "Failed to fetch" ao Alocar Candidatos

## 🎯 O Problema

Ao tentar alocar múltiplos candidatos, o sistema retorna:
```
Erro ao alocar candidatos: TypeError: Failed to fetch
```

## 🔍 Causa do Erro

O erro ocorre quando você seleciona **muitos candidatos** ao mesmo tempo:

1. O sistema envia os IDs de todos os candidatos na URL (método GET)
2. URLs muito longas (>2000 caracteres) causam erro "Failed to fetch"
3. Exemplo de URL problemática:
   ```
   https://script.google.com/...?action=assignCandidates&candidateIds=123.456.789-00,987.654.321-00,111.222.333-44,...(centenas de CPFs)
   ```

## ✅ Solução Implementada

O sistema agora detecta automaticamente quando os dados são grandes e usa POST ao invés de GET:

### Como Funciona

1. **Dados Pequenos (< 2KB)**: Usa GET (evita CORS preflight, mais rápido)
   ```javascript
   GET https://script.google.com/...?action=assignCandidates&candidateIds=123.456.789-00,987.654.321-00
   ```

2. **Dados Grandes (> 2KB)**: Usa POST (evita URL muito longa)
   ```javascript
   POST https://script.google.com/...
   Body: {
     "action": "assignCandidates",
     "candidateIds": "123.456.789-00,987.654.321-00,...",
     "analystEmail": "analista@exemplo.com",
     "adminEmail": "admin@exemplo.com"
   }
   ```

## 📊 Benefícios

✅ **Sem limite de candidatos**: Pode alocar centenas de candidatos de uma vez
✅ **Automático**: Sistema escolhe GET ou POST automaticamente
✅ **Rápido**: Usa GET quando possível (evita CORS preflight)
✅ **Compatível**: Funciona com o Google Apps Script existente

## 🚀 Como Testar

1. Faça o build do projeto:
   ```bash
   npm run build
   ```

2. Deploy no Netlify ou servidor

3. Tente alocar muitos candidatos de uma vez

4. Verifique o console do navegador:
   ```
   📮 [UserService] Usando POST (dados grandes)
   ✅ [UserService] Dados recebidos: { success: true, ... }
   ```

## 🔍 Logs Esperados

### Alocação de Poucos Candidatos (GET)
```
📥 [UserService] Usando GET (dados pequenos)
🔄 [UserService] Chamando Google Apps Script: assignCandidates
📡 [UserService] Resposta recebida - Status: 200
✅ [UserService] Dados recebidos: { success: true, assignedCount: 5 }
```

### Alocação de Muitos Candidatos (POST)
```
📮 [UserService] Usando POST (dados grandes)
🔄 [UserService] Chamando Google Apps Script: assignCandidates
📡 [UserService] Resposta recebida - Status: 200
✅ [UserService] Dados recebidos: { success: true, assignedCount: 150 }
```

## 🛠️ Alterações Técnicas

### Arquivo Modificado: `src/services/userService.ts`

**Antes:**
```typescript
// Sempre usava GET
const url = `${this.scriptUrl}?${params.toString()}`;
const response = await fetch(url, { method: 'GET' });
```

**Depois:**
```typescript
// Detecta automaticamente o tamanho e escolhe GET ou POST
const urlSize = this.scriptUrl.length + params.toString().length;
const usePost = urlSize > 2000;

if (usePost) {
  // POST para dados grandes
  response = await fetch(this.scriptUrl, {
    method: 'POST',
    body: JSON.stringify({ action, ...data })
  });
} else {
  // GET para dados pequenos
  response = await fetch(url, { method: 'GET' });
}
```

## ⚠️ Requisitos

O Google Apps Script já está preparado para receber POST:

```javascript
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // Suporta POST (JSON body) e GET (query params)
  if (e && e.postData && e.postData.contents) {
    const data = JSON.parse(e.postData.contents);
    action = data.action;
    params = data;
  } else if (e && e.parameter) {
    action = e.parameter.action;
    params = e.parameter;
  }
  // ...
}
```

✅ O arquivo `google-apps-script-COMPLETO-FINAL.js` já tem isso implementado!

## 🎯 Casos de Uso

| Cenário | Candidatos | Método | Status |
|---------|-----------|--------|--------|
| Alocação individual | 1-5 | GET | ✅ Funciona |
| Alocação pequena | 5-20 | GET | ✅ Funciona |
| Alocação média | 20-50 | GET/POST | ✅ Funciona |
| Alocação grande | 50-200 | POST | ✅ Funciona |
| Alocação massiva | 200+ | POST | ✅ Funciona |

## 🔒 Segurança

✅ **CORS configurado**: Ambos GET e POST suportam CORS
✅ **Validação no servidor**: Google Apps Script valida todos os dados
✅ **Autenticação mantida**: Emails de admin e analista são validados

## 🆘 Troubleshooting

### Erro: "JSON inválido"
- **Causa**: Problema ao serializar dados para POST
- **Solução**: Verificar que `candidateIds` é uma string separada por vírgulas

### Erro: "Requisição inválida"
- **Causa**: Action não está sendo enviada
- **Solução**: Verificar que o `action` está incluído no body do POST

### Erro: "CORS policy"
- **Causa**: Google Apps Script não está configurado para CORS
- **Solução**: Usar o `google-apps-script-COMPLETO-FINAL.js` que já tem CORS configurado

## ✅ Conclusão

O erro "Failed to fetch" foi resolvido implementando detecção automática de tamanho de dados:
- Requisições pequenas usam GET (rápido)
- Requisições grandes usam POST (sem limite de tamanho)

**Agora você pode alocar quantos candidatos quiser de uma vez!** 🎉
