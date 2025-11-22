# Solução Completa: Email e SMS

## Diagnóstico dos Problemas

### ✅ Problema 1: Email está sendo enviado, mas status não atualiza

**Sintomas:**
- Emails são enviados com sucesso
- Candidato recebe o email
- Campo "Email Enviado" fica vazio no frontend
- Status só aparece após ~20 minutos

**Causa Raiz:**
A função `_updateMessageStatusInCandidates_()` no Google Apps Script atualiza a célula na planilha, mas esquece de chamar `_bumpRev_()` para invalidar o cache. Isso significa que:
- A planilha é atualizada ✅
- O cache não é invalidado ❌
- O frontend continua lendo dados antigos do cache ❌

**Solução:**
Adicionar `_bumpRev_();` logo após atualizar a célula.

---

### ⚠️ Problema 2: SMS não está sendo enviado

**Sintomas:**
- Ao tentar enviar SMS, retorna erro: "Twilio não configurado"
- Nenhum SMS é enviado

**Causa Raiz:**
As credenciais do Twilio não foram configuradas nas Propriedades do Script do Google Apps Script.

**Solução:**
Configurar as 3 propriedades obrigatórias: `TWILIO_SID`, `TWILIO_TOKEN` e `TWILIO_FROM`.

---

## Correções Aplicadas

### Frontend (src/components/MessagingModal.tsx)

**Mudança:**
Removida a chamada duplicada para `updateMessageStatus()` porque o Google Apps Script já atualiza o status automaticamente dentro da função `sendMessages()`.

**Antes:**
```typescript
// Chamava updateMessageStatus() manualmente após enviar
const updateResult = await googleSheetsService.updateMessageStatus(
  successfulCandidates.map(c => c.registration_number || c.CPF || c.id),
  messageType,
  'Sim'
);
```

**Depois:**
```typescript
// O status já é atualizado automaticamente pelo Google Apps Script
// na função _updateMessageStatusInCandidates_ dentro de sendMessages
```

Isso simplifica o código e evita conflitos de atualização.

---

### Backend (Google Apps Script)

**Mudança:**
Adicionado `_bumpRev_()` na função `_updateMessageStatusInCandidates_()`.

**Antes:**
```javascript
sh.getRange(row, targetCol + 1).setValue('Sim');
Logger.log('✅ Status de mensagem atualizado para ' + cpf + ' - ' + messageType);
```

**Depois:**
```javascript
sh.getRange(row, targetCol + 1).setValue('Sim');
_bumpRev_(); // Invalida cache para atualizar frontend imediatamente
Logger.log('✅ Status de mensagem atualizado para ' + cpf + ' - ' + messageType);
```

---

## Como Aplicar as Correções

### 1. Atualizar Frontend (já aplicado automaticamente)

O arquivo `src/components/MessagingModal.tsx` já foi corrigido.

### 2. Atualizar Google Apps Script

**Opção A - Substituir Função Específica:**

1. Abra seu Google Apps Script
2. Localize a função `_updateMessageStatusInCandidates_` (linha ~1179)
3. Adicione `_bumpRev_();` após a linha:
   ```javascript
   sh.getRange(row, targetCol + 1).setValue('Sim');
   _bumpRev_(); // ← ADICIONE ESTA LINHA
   ```

**Opção B - Substituir Script Completo (Recomendado):**

1. Abra seu Google Apps Script
2. Substitua TODO o conteúdo pelo arquivo:
   ```
   google-apps-script-CORRIGIDO-STATUS.js
   ```
3. Salve e implante

### 3. Configurar Twilio (Opcional - apenas se precisar de SMS)

1. Crie conta no Twilio: https://www.twilio.com/try-twilio
2. Obtenha:
   - Account SID
   - Auth Token
   - Número Twilio
3. No Google Apps Script → Configurações → Propriedades do Script
4. Adicione:
   - `TWILIO_SID` = ACxxxxxxxx...
   - `TWILIO_TOKEN` = xxxxxxxx...
   - `TWILIO_FROM` = +5511999999999

**Nota:** Se você não precisa de SMS agora, pode pular esta etapa. O sistema funcionará normalmente apenas com emails.

---

## Testando as Correções

### Teste 1: Verificar Status de Email

1. Envie um email para um candidato
2. Atualize a página do frontend (F5)
3. ✅ O campo "Email Enviado" deve mostrar "Sim" imediatamente

### Teste 2: Verificar SMS (se configurou Twilio)

1. Envie um SMS para um candidato
2. Verifique os logs do Google Apps Script (Execuções)
3. ✅ Deve mostrar:
   ```
   📱 Enviando SMS para: +5511999999999
   ✅ SMS enviado com sucesso
   SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## Fluxo Correto de Envio de Mensagens

### Email
1. Frontend chama `sendMessages()` via `googleSheetsService`
2. Google Apps Script:
   - Envia email via `_sendEmailGmail_()`
   - Registra log em `MENSAGENS`
   - Atualiza status com `_updateMessageStatusInCandidates_()`
   - Invalida cache com `_bumpRev_()` ← **CORRIGIDO**
3. Frontend recarrega lista com `onMessagesSent()`
4. ✅ Status aparece atualizado imediatamente

### SMS
1. Frontend chama `sendMessages()` com `messageType: 'sms'`
2. Google Apps Script:
   - Verifica se Twilio está configurado com `_twilioEnabled_()`
   - Se SIM: envia SMS via API do Twilio
   - Se NÃO: retorna erro "Twilio não configurado"
   - Atualiza status da mesma forma que email

---

## Arquivos Gerados

| Arquivo | Descrição |
|---------|-----------|
| `google-apps-script-CORRIGIDO-STATUS.js` | Script completo com correção aplicada |
| `CORRECAO_STATUS_EMAIL_SMS.md` | Explicação técnica detalhada |
| `CONFIGURAR_TWILIO_SMS.md` | Guia completo de configuração do Twilio |
| `GUIA_RAPIDO_CORRECAO_MENSAGENS.md` | Guia rápido de 2 minutos |
| `SOLUCAO_COMPLETA_MENSAGENS.md` | Este arquivo |

---

## Resumo Executivo

| Item | Status | Ação Necessária |
|------|--------|----------------|
| Envio de Email | ✅ Funcionando | Nenhuma |
| Status de Email | ✅ Corrigido | Atualizar Google Apps Script |
| Envio de SMS | ⚠️ Requer Config | Configurar Twilio (opcional) |
| Status de SMS | ✅ Funcionará | Após configurar Twilio |

---

## Suporte

Se após aplicar as correções ainda houver problemas:

1. Verifique os logs do Google Apps Script (aba "Execuções")
2. Verifique o console do navegador (F12)
3. Confirme que o cache foi limpo (Ctrl+Shift+R)
4. Verifique se a revisão do cache foi incrementada:
   ```javascript
   function verificarRevisao() {
     Logger.log('Revisão atual:', _getRev_());
   }
   ```
