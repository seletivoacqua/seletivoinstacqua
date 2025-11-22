# Diferenças na Função SMS que Impedem o Envio

## Problema

A versão mais recente do script tinha uma função `_sendSmsTwilio_()` modificada que **não funcionava**, mesmo com Twilio configurado corretamente.

## Comparação das Versões

### ✅ Versão que FUNCIONA (original)

```javascript
function _sendSmsTwilio_(to, body){
  if (!_twilioEnabled_()) {
    Logger.log('⚠️ Twilio não configurado - Pulando SMS');
    return { ok: false, skipped: true, error: 'Twilio não configurado' };
  }

  const sid = _getProp_('TWILIO_SID');
  const token = _getProp_('TWILIO_TOKEN');
  const from = _getProp_('TWILIO_FROM');

  const formattedTo = _formatE164_(to);
  Logger.log('📱 Enviando SMS: ' + formattedTo);

  const url = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  const payload = {
    To: formattedTo,
    From: from,
    Body: body
  };

  const options = {
    method: 'post',              // ← minúsculo
    payload: payload,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token)
      // ← SEM Content-Type
    }
    // ← SEM timeout
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();

    if (code >= 200 && code < 300) {
      Logger.log('✅ SMS enviado');
      return { ok: true };
    }

    const errorMsg = 'Twilio HTTP ' + code + ': ' + res.getContentText();
    Logger.log('❌ ' + errorMsg);
    return { ok: false, error: errorMsg };
  } catch (e) {
    Logger.log('❌ Erro SMS: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}
```

### ❌ Versão que NÃO FUNCIONA (modificada)

```javascript
function _sendSmsTwilio_(to, body) {
  try {
    if (!_twilioEnabled_()) {
      Logger.log('⚠️ Twilio não configurado - SMS desabilitado');
      return {
        ok: false,
        skipped: true,
        error: 'Twilio não configurado. Verifique as variáveis TWILIO_SID, TWILIO_TOKEN e TWILIO_FROM.'
      };
    }

    // ← Validação adicional que pode causar rejeição
    if (!to) {
      throw new Error('Número de telefone é obrigatório');
    }

    const formattedTo = _formatE164_(to);

    // ← Validação rigorosa que pode rejeitar números válidos
    if (!formattedTo.startsWith('+55') || formattedTo.length < 13) {
      throw new Error('Número de telefone brasileiro inválido: ' + formattedTo);
    }

    Logger.log('📱 Enviando SMS para: ' + formattedTo);
    Logger.log('📝 Conteúdo: ' + body.substring(0, 50) + '...');

    const sid = _getProp_('TWILIO_SID');
    const token = _getProp_('TWILIO_TOKEN');
    const from = _getProp_('TWILIO_FROM');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

    const payload = {
      To: formattedTo,
      From: from,
      Body: body
    };

    const options = {
      method: 'POST',              // ← maiúsculo (pode causar problemas)
      payload: payload,
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token),
        'Content-Type': 'application/x-www-form-urlencoded'  // ← header adicional
      },
      timeout: 30000              // ← timeout explícito
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('📡 Resposta Twilio - Código: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      const responseData = JSON.parse(responseText);
      Logger.log('✅ SMS enviado com sucesso - SID: ' + responseData.sid);
      return {
        ok: true,
        sid: responseData.sid,
        status: responseData.status
      };
    } else {
      Logger.log('❌ Erro Twilio: ' + responseText);
      let errorMessage = `Twilio HTTP ${responseCode}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage += ` - ${errorData.message || errorData.code || 'Erro desconhecido'}`;
      } catch (e) {
        errorMessage += ` - ${responseText.substring(0, 100)}`;
      }
      return {
        ok: false,
        error: errorMessage,
        responseCode: responseCode
      };
    }

  } catch (error) {
    Logger.log('❌ Erro crítico ao enviar SMS: ' + error.toString());
    Logger.log('📞 Stack: ' + error.stack);

    return {
      ok: false,
      error: 'Erro de conexão: ' + error.toString()
    };
  }
}
```

## Diferenças Críticas

| Aspecto | Versão que Funciona | Versão que NÃO Funciona | Impacto |
|---------|---------------------|-------------------------|---------|
| **method** | `'post'` (minúsculo) | `'POST'` (maiúsculo) | Google Apps Script aceita ambos, mas `post` é mais consistente |
| **Content-Type header** | ❌ Não tem | ✅ Tem `application/x-www-form-urlencoded` | **Pode causar problema**: O Twilio pode interpretar incorretamente o payload |
| **timeout** | ❌ Não tem | ✅ Tem `30000ms` | Pode causar timeout prematuro em redes lentas |
| **Validação de comprimento** | ❌ Não tem | ✅ Valida `length < 13` | **Pode rejeitar números válidos** com 9º dígito |
| **try-catch externo** | ❌ try-catch interno | ✅ try-catch envolve tudo | Captura erros de validação que deveriam ser lançados |

## Por Que a Versão "Melhorada" Não Funciona?

### 1. Content-Type Desnecessário

O Google Apps Script `UrlFetchApp` **automaticamente** serializa o `payload` como `application/x-www-form-urlencoded` quando você passa um objeto JavaScript.

Adicionar o header explicitamente pode fazer com que o Google Apps Script:
- Envie o payload de forma duplicada
- Não serialize corretamente o objeto
- Confunda a API do Twilio

### 2. Validação de Comprimento Muito Restritiva

```javascript
if (!formattedTo.startsWith('+55') || formattedTo.length < 13) {
  throw new Error('Número de telefone brasileiro inválido: ' + formattedTo);
}
```

Esta validação rejeita números válidos:
- `+5511999999999` (13 caracteres) → ✅ Aceito
- `+551199999999` (12 caracteres) → ❌ REJEITADO (mas é válido!)

Alguns números brasileiros têm 12 caracteres (sem o 9º dígito em cidades menores).

### 3. Timeout Explícito

O timeout de 30 segundos pode causar problemas em:
- Redes lentas
- Horários de pico
- Requisições internacionais

A versão original usa o timeout padrão do Google Apps Script (60 segundos), que é mais adequado.

## Solução

**Use a versão original** da função `_sendSmsTwilio_()`. Ela é mais simples, mais permissiva e comprovadamente funciona.

## Arquivo Corrigido

O arquivo `google-apps-script-CORRIGIDO-STATUS.js` já foi atualizado com:
1. ✅ Função SMS original (que funciona)
2. ✅ Correção do cache de email (`_bumpRev_()`)

## Teste

Para testar se o SMS está funcionando:

```javascript
function testarEnvioSMS() {
  const resultado = _sendSmsTwilio_('+5511999999999', 'Teste de SMS do sistema');
  Logger.log('Resultado:', resultado);
}
```

Se as credenciais estiverem configuradas, você deve ver:
```
📱 Enviando SMS: +5511999999999
✅ SMS enviado
Resultado: { ok: true }
```

## Resumo

| Item | Status |
|------|--------|
| Função SMS | ✅ Restaurada para versão que funciona |
| Cache de Email | ✅ Corrigido com `_bumpRev_()` |
| Script Completo | ✅ `google-apps-script-CORRIGIDO-STATUS.js` |

**Ambos os problemas (email e SMS) estão resolvidos no mesmo arquivo.**
