// ============================================
// SUBSTITUA APENAS ESTA FUNÇÃO NO SEU GOOGLE APPS SCRIPT
// Localize a função _sendSmsTwilio_ e substitua por esta versão
// ============================================

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
    method: 'post',
    payload: payload,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token)
    }
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
