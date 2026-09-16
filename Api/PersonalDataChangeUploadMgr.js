const ExternalConfig = require('../ExternalConfig');
const { createUploadMgr } = require('./UploadMgr');

// 個人資料變更申請的身分證明文件上傳（身分證正反面）。獨立子目錄 uploads/personal-data-change/。
const rules = ExternalConfig.PersonalDataChangeUpload || {};

module.exports = createUploadMgr({
    dirName: 'personal-data-change',
    maxFileSizeMB: rules.MaxFileSizeMB,
    maxFileCount: rules.MaxFileCount,
    allowedExt: rules.AllowedExt
});
