const ExternalConfig = require('../ExternalConfig');
const { createUploadMgr } = require('./UploadMgr');

// 學生寒暑假轉館的學生證明上傳（ChangeMembershipForm.js 學生轉館「學生證明」）。獨立子目錄 uploads/student/。
const rules = ExternalConfig.StudentTransferUpload || {};

module.exports = createUploadMgr({
    dirName: 'student',
    maxFileSizeMB: rules.MaxFileSizeMB,
    maxFileCount: rules.MaxFileCount,
    allowedExt: rules.AllowedExt
});
