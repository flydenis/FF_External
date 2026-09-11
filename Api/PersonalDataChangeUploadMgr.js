const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ExternalConfig = require('../ExternalConfig');

// 個人資料變更申請的身分證明文件上傳。存放路徑固定為 uploads/，檔名一律伺服器端產生（不採信使用者原始檔名），
// 防 Path Manipulation（CWE-22）。型態/大小/數量限制走 ExternalConfig.PersonalDataChangeUpload。
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const rules = ExternalConfig.PersonalDataChangeUpload || {};
const allowedExt = rules.AllowedExt || ['.jpg', '.jpeg', '.png', '.pdf'];

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: (rules.MaxFileSizeMB || 10) * 1024 * 1024,
        files: rules.MaxFileCount || 5
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!allowedExt.includes(ext)) return cb(new Error(`不支援的檔案格式：${ext}`));
        cb(null, true);
    }
});

// 回傳前端可保存、日後隨表單一併送出的檔案參考清單。
function buildFileRefs(files) {
    return (files || []).map(f => ({ fileId: f.filename, fileName: f.originalname, size: f.size }));
}

module.exports = {
    arrayUpload: upload.array('files', rules.MaxFileCount || 5),
    buildFileRefs,
    uploadDir
};
