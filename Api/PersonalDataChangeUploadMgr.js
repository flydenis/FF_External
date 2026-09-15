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
const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };

// multer/busboy 依 multipart 規範預設把檔名當 latin1 解碼，中文（UTF-8 多位元組）因此變亂碼。
// 瀏覽器實際送出的是 UTF-8 位元組，這裡轉回來：先以 latin1 還原成原始位元組，再用 utf8 重新解碼。
function fixFilenameEncoding(name) {
    if (!name) return name;
    return Buffer.from(name, 'latin1').toString('utf8');
}

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
        // 修正發生在 fileFilter（multer 管線最早拿到 file 物件的地方），修正後的 originalname 會沿用到
        // storage.filename 與最終 req.files，buildFileRefs 才不會把亂碼檔名送回前端/ECP。
        file.originalname = fixFilenameEncoding(file.originalname);
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!allowedExt.includes(ext)) return cb(new Error(`不支援的檔案格式：${ext}`));
        cb(null, true);
    }
});

// 回傳前端可保存、日後隨表單一併送出的檔案參考清單（不含檔案內容）。
function buildFileRefs(files) {
    return (files || []).map(f => ({ fileId: f.filename, fileName: f.originalname, size: f.size }));
}

// 只信任 fileId 的 basename，避免路徑穿越（CWE-22）；解析後路徑須仍在 uploadDir 內才允許讀取/刪除。
function resolveSafePath(fileId) {
    if (!fileId) return null;
    const safeName = path.basename(String(fileId));
    const filePath = path.join(uploadDir, safeName);
    if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) return null;
    return filePath;
}

// 依 fileId 讀回暫存檔內容，供上傳到 ECP 附件 API 前取得實際 bytes。讀不到（檔案不存在/路徑不合法）回 null。
function readFile(fileId) {
    const filePath = resolveSafePath(fileId);
    if (!filePath) return null;
    try {
        return fs.readFileSync(filePath);
    } catch (e) {
        return null;
    }
}

// 上傳到 ECP 成功後呼叫，清掉本機暫存檔，避免 uploads/ 累積孤兒檔案。刪除失敗只記 log，不影響流程。
function removeFile(fileId, logger) {
    const filePath = resolveSafePath(fileId);
    if (!filePath) return;
    fs.unlink(filePath, (err) => {
        if (err) logger && logger.AlertLog(`[PersonalDataChangeUploadMgr] 刪除暫存檔失敗: ${filePath} - ${err.message}`);
    });
}

// 依副檔名推斷 Content-Type（僅支援 allowedExt 範圍內的格式）。
function mimeFromExt(fileNameOrId) {
    const ext = path.extname(String(fileNameOrId || '')).toLowerCase();
    return MIME_BY_EXT[ext] || 'application/octet-stream';
}

module.exports = {
    arrayUpload: upload.array('files', rules.MaxFileCount || 5),
    buildFileRefs,
    readFile,
    removeFile,
    mimeFromExt,
    uploadDir
};
