const ExternalConfig = require('../ExternalConfig');
const { createUploadMgr } = require('./UploadMgr');

// 會籍請假暫停申請的證明文件上傳（LeaveForm.js 第 2 頁「證明文件」）。獨立子目錄 uploads/leave/。
const rules = ExternalConfig.LeaveUpload || {};

module.exports = createUploadMgr({
    dirName: 'leave',
    maxFileSizeMB: rules.MaxFileSizeMB,
    maxFileCount: rules.MaxFileCount,
    allowedExt: rules.AllowedExt
});
