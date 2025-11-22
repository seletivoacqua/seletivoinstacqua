# Guia Rápido: Correção de Email e SMS

## Problema 1: Status de Email Não Atualiza ✅

### O que está acontecendo:
- Emails são enviados com sucesso
- Mas o campo "Email Enviado" não atualiza no frontend

### Causa:
A função que atualiza o status não invalida o cache

### Solução (2 minutos):

1. Abra o Google Apps Script
2. Localize a linha 1209 (função `_updateMessageStatusInCandidates_`)
3. Após a linha:
   ```javascript
   sh.getRange(row, targetCol + 1).setValue('Sim');
   ```
4. Adicione:
   ```javascript
   _bumpRev_(); // Invalida cache
   ```

**OU simplesmente substitua o script inteiro por**:
`google-apps-script-CORRIGIDO-STATUS.js` (já está corrigido)

---

## Problema 2: SMS Não Envia ⚠️

### O que está acontecendo:
- Ao tentar enviar SMS, retorna: "Twilio não configurado"

### Causa:
Credenciais do Twilio não foram configuradas

### Solução Rápida - Opção A: Configurar Twilio (5 minutos)

1. Crie conta no Twilio: https://www.twilio.com/try-twilio
2. Obtenha as credenciais no painel
3. No Google Apps Script, vá em **Configurações → Propriedades do Script**
4. Adicione:
   - `TWILIO_SID` = seu Account SID
   - `TWILIO_TOKEN` = seu Auth Token
   - `TWILIO_FROM` = seu número Twilio (+5511999999999)

### Solução Rápida - Opção B: Desabilitar SMS

Se você não precisa de SMS agora, simplesmente:
- Use apenas emails (funcionam perfeitamente)
- Ignore o erro de SMS

---

## Resumo das Correções

| Problema | Status | Solução | Tempo |
|----------|--------|---------|-------|
| Email não atualiza status | ✅ Corrigido | Adicionar `_bumpRev_()` | 2 min |
| SMS não envia | ⚠️ Requer config | Configurar Twilio | 5 min |

---

## Arquivos Relevantes

- `google-apps-script-CORRIGIDO-STATUS.js` - Script corrigido completo
- `CORRECAO_STATUS_EMAIL_SMS.md` - Explicação detalhada
- `CONFIGURAR_TWILIO_SMS.md` - Guia completo do Twilio

---

## Como Testar

### Teste 1: Status de Email
1. Substitua o script no Apps Script
2. Envie um email para um candidato
3. Atualize a página do frontend
4. ✅ Status deve aparecer imediatamente

### Teste 2: SMS
1. Configure as propriedades do Twilio
2. Envie um SMS de teste
3. Verifique os logs do Apps Script
4. ✅ Deve mostrar "SMS enviado" com um SID
