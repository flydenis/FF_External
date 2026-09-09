const log4js = require('log4js');
const log_config = require('../log_config.json');
log4js.configure(log_config);
const ExternalConfig = require('../ExternalConfig');

// 防 Log Forging / Log Injection（CWE-117）：所有 log 出口都先中和換行與控制字元，
// 使用者輸入就無法用換行偽造 log 行。內容不變、僅把 C0 控制碼/DEL 換成空白（Fortify 認得的單一 cleanse 出口）。
function sanitizeForLog(log) {
    const raw = typeof log === 'string' ? log : JSON.stringify(log);
    if (raw == null) return '';
    let out = '';
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        out += (code < 0x20 || code === 0x7f) ? ' ' : raw[i];
    }
    return out;
}

class Logger {
    constructor(category, chatId) {
        this.logger = log4js.getLogger(category || 'app');
        this.logger.addContext('chatId', sanitizeForLog(chatId) || 'unknown');
        this.logger.addContext('uId', Date.now().toString().slice(-3));
    }
    InfoLog(log) {
        const safe = sanitizeForLog(log);
        if (ExternalConfig.Mode === 'development') console.log('[Info]', safe);
        this.logger.info(safe);
    }
    AlertLog(log) {
        const safe = sanitizeForLog(log);
        if (ExternalConfig.Mode === 'development') console.log('[Alert]', safe);
        this.logger.error(safe);
    }
    ErrorLog(log) { this.AlertLog(log); }
}

Logger.maskId = v => {
    const s = String(v == null ? '' : v).trim().toUpperCase();
    return s.length < 5 ? '****' : s.slice(0, 1) + '****' + s.slice(-3);
};
Logger.maskBirthday = v => {
    const m = String(v == null ? '' : v).trim().match(/^(\d{2,4})[-/]?\d{2}[-/]?\d{2}$/);
    return m ? `${m[1]}-**-**` : '****';
};
Logger.maskMobile = v => {
    const s = String(v == null ? '' : v).replace(/\D/g, '');
    return !s ? '' : (s.length <= 3 ? '***' : `****${s.slice(-3)}`);
};

module.exports = Logger;
