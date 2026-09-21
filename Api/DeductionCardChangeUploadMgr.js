const { createUploadMgr } = require('./UploadMgr');
const ExternalConfig = require('../ExternalConfig');

const rules = ExternalConfig.DeductionCardChangeUpload || {};

// 扣款卡片變更申請的信用卡授權書上傳，走共用 UploadMgr 工廠（比照 PersonalDataChangeUploadMgr 的薄包裝作法）。
module.exports = createUploadMgr({
    dirName: 'deduction-card-change',
    maxFileSizeMB: rules.MaxFileSizeMB,
    maxFileCount: rules.MaxFileCount,
    allowedExt: rules.AllowedExt
});
