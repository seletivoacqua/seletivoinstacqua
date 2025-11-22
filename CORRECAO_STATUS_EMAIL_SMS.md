# Correção: Status de Email e Configuração SMS

## Problemas Identificados

### 1. Status de Email não Atualiza no Frontend

**Causa**: A função `_updateMessageStatusInCandidates_` no Google Apps Script está atualizando a planilha corretamente, mas não está invalidando o cache com `_bumpRev_()`. Resultado: o frontend só vê a mudança após 20 minutos (quando o cache expira).

**Solução**: Adicionar `_bumpRev_()` na função.

### 2. SMS Não Está Sendo Enviado

**Causa**: Credenciais do Twilio não foram configuradas no Google Apps Script.

**Solução**: Configurar as propriedades `TWILIO_SID`, `TWILIO_TOKEN` e `TWILIO_FROM`.

---

## Correção 1: Atualização de Status de Email

No arquivo **Google Apps Script** (`google-apps-script-PRODUCAO-COMPLETO.js`), localize a função `_updateMessageStatusInCandidates_` (linha ~1179) e substitua por:

```javascript
function _updateMessageStatusInCandidates_(cpf, messageType) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    if (!sh) return;

    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);
    const cpfCol = col['CPF'];

    let targetCol;
    if (messageType === 'email') {
      targetCol = col['EMAIL_SENT'];
    } else if (messageType === 'sms') {
      targetCol = col['SMS_SENT'];
    }

    if (targetCol === undefined || targetCol < 0) {
      Logger.log('⚠️ Coluna ' + (messageType === 'email' ? 'EMAIL_SENT' : 'SMS_SENT') + ' não encontrada');
      return;
    }

    const idx = _getIndex_(sh, headers);
    const searchKey = String(cpf).trim();
    const row = idx[searchKey];

    if (!row) {
      Logger.log('⚠️ Candidato não encontrado para atualizar status de mensagem: ' + cpf);
      return;
    }

    sh.getRange(row, targetCol + 1).setValue('Sim');
    _bumpRev_(); // ← ADICIONE ESTA LINHA PARA INVALIDAR O CACHE
    Logger.log('✅ Status de mensagem atualizado para ' + cpf + ' - ' + messageType);

  } catch (error) {
    Logger.log('❌ Erro ao atualizar status de mensagem: ' + error.toString());
  }
}
```

**O que muda**: Adicionamos `_bumpRev_();` logo após atualizar a célula, para que o cache seja invalidado imediatamente.

---

## Correção 2: Configuração do Twilio para SMS

### Opção A: Configurar Twilio (Recomendado para Produção)

1. **Criar conta no Twilio**:
   - Acesse: https://www.twilio.com/try-twilio
   - Crie uma conta gratuita

2. **Obter credenciais**:
   - No painel do Twilio, copie:
     - **Account SID** (começa com `AC...`)
     - **Auth Token** (clique em "Show")
   - Compre um número Twilio com capacidade de SMS

3. **Configurar no Google Apps Script**:
   - Vá em **Configurações do Projeto** → **Propriedades do Script**
   - Adicione estas 3 propriedades:

| Propriedade | Valor | Exemplo |
|------------|-------|---------|
| `TWILIO_SID` | Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_TOKEN` | Auth Token | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_FROM` | Número Twilio | `+5511999999999` |

4. **Testar**:
   ```javascript
   function testarTwilio() {
     const enabled = _twilioEnabled_();
     Logger.log('Twilio configurado?', enabled);
   }
   ```

**Custos**:
- SMS nacional (Brasil): ~$0.058 por SMS
- Número Twilio: ~$1.15/mês
- Conta trial: ~$15 USD de crédito grátis, mas só envia para números verificados

### Opção B: Desabilitar SMS Temporariamente

Se você não precisa de SMS agora, pode simplesmente usar apenas emails:

1. Remova a opção de SMS do frontend (opcional)
2. O sistema continuará funcionando normalmente com emails

---

## Verificação

### 1. Testar Atualização de Status de Email

1. Envie um email para um candidato
2. Verifique nos logs do Apps Script:
   ```
   ✅ Status de mensagem atualizado para [CPF] - email
   ```
3. Atualize a página do frontend
4. O status "Email Enviado" deve aparecer imediatamente

### 2. Testar SMS

1. Configure as credenciais do Twilio
2. Envie um SMS de teste
3. Verifique nos logs:
   ```
   ✅ SMS enviado para +5511999999999
   SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## Resumo das Mudanças

✅ **Email**:
- Adicione `_bumpRev_()` na função `_updateMessageStatusInCandidates_`
- Status agora atualiza imediatamente no frontend

⚠️ **SMS**:
- Configure as 3 propriedades do Twilio no Google Apps Script
- Para produção, faça upgrade da conta trial
- Alternativa: Use apenas emails (grátis)

---

## Arquivo Atualizado Completo

O arquivo corrigido está sendo gerado como `google-apps-script-CORRIGIDO-STATUS.js` com todas as correções aplicadas.
