# Como Configurar o Twilio para Envio de SMS

## Problema Identificado

O sistema de SMS está retornando "Twilio não configurado" porque as credenciais não foram definidas no Google Apps Script.

## Solução: Configurar o Twilio

### Passo 1: Criar Conta no Twilio

1. Acesse: https://www.twilio.com/try-twilio
2. Crie uma conta gratuita (trial account)
3. Verifique seu número de telefone

### Passo 2: Obter as Credenciais

1. No painel do Twilio (https://console.twilio.com/), encontre:
   - **Account SID** (exemplo: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** (clique em "Show" para ver)

2. Obtenha um número Twilio:
   - Vá em: Phone Numbers > Manage > Buy a number
   - Escolha um número com capacidade de SMS
   - Para contas trial, você precisará verificar os números de destino primeiro

### Passo 3: Configurar no Google Apps Script

1. Abra seu projeto no Google Apps Script
2. Vá em **Configurações do Projeto** (ícone de engrenagem na lateral)
3. Role até **Propriedades do Script**
4. Clique em **Adicionar propriedade do script**

Adicione estas 3 propriedades:

| Propriedade | Valor | Descrição |
|------------|-------|-----------|
| `TWILIO_SID` | ACxxxxxxxx... | Account SID do Twilio |
| `TWILIO_TOKEN` | seu_auth_token | Auth Token do Twilio |
| `TWILIO_FROM` | +5511999999999 | Número Twilio (formato E.164) |

### Passo 4: Limitações da Conta Trial

A conta trial do Twilio tem algumas limitações:

- Você só pode enviar SMS para **números verificados**
- Cada SMS terá um prefixo: "Sent from your Twilio trial account - "
- Crédito limitado (~$15 USD)

Para remover essas limitações, você precisa:
1. Fazer upgrade para conta paga
2. Adicionar um método de pagamento

### Passo 5: Verificar Números (Conta Trial)

Se você está usando conta trial, precisa verificar os números de destino:

1. Vá em: Phone Numbers > Manage > Verified Caller IDs
2. Clique em "Add a new Caller ID"
3. Digite o número do candidato
4. Twilio enviará um código de verificação
5. Digite o código para verificar

**Importante**: Isso é impraticável para uso em produção. Para enviar SMS para múltiplos candidatos, você PRECISA fazer upgrade para conta paga.

## Verificar se Está Funcionando

Após configurar as propriedades, teste:

1. No Google Apps Script, execute a função de teste:

```javascript
function testarTwilio() {
  const resultado = _twilioEnabled_();
  Logger.log('Twilio configurado?', resultado);

  if (resultado) {
    Logger.log('Todas as credenciais estão presentes!');
  } else {
    Logger.log('Faltam credenciais. Verifique as propriedades do script.');
  }
}
```

2. Veja o resultado em **Execuções** (ícone de relógio na lateral)

## Custos do Twilio

- **SMS nacional (Brasil)**: ~$0.058 por SMS
- **SMS internacional**: varia por país
- **Número Twilio**: ~$1.15/mês

## Alternativas ao Twilio

Se o custo for um problema, considere:

1. **Email em vez de SMS**: Use apenas emails (grátis via Gmail)
2. **WhatsApp Business API**: Mais barato, mas requer aprovação
3. **SMS Gateway brasileiro**:
   - Zenvia
   - TotalVoice
   - SMS Brasil

## Resumo

✅ **Email**: Funcionando automaticamente via Gmail (grátis)
⚠️ **SMS**: Requer configuração do Twilio + conta paga para produção

O status de email já está sendo atualizado corretamente pela função `_updateMessageStatusInCandidates_` dentro de `sendMessages`.
