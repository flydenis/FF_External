const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// 通用上傳管理器工廠：任何流程要「選檔上傳、換回檔案參考、之後讀回內容送 ECP」，都呼叫這裡建一個實例，
// 不用每支流程各自重寫一份 multer 設定／路徑防護／中文檔名編碼修正。目前 PersonalDataChangeUploadMgr／
// AgentUploadMgr／LeaveUploadMgr 都是這個工廠的薄包裝，各自只帶自己的子目錄與限制規則。
// options: { dirName（uploads/ 底下的子目錄名，必填）、maxFileSizeMB、maxFileCount、allowedExt（副檔名陣列） }
function createUploadMgr({ dirName, maxFileSizeMB = 10, maxFileCount = 10, allowedExt = ['.jpg', '.jpeg', '.png'] }) {
    if (!dirName) throw new Error('createUploadMgr 需要 dirName（uploads/ 底下的子目錄名）');

    const uploadDir = path.join(__dirname, '..', 'uploads', dirName);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
            fileSize: maxFileSizeMB * 1024 * 1024,
            files: maxFileCount
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

    // 上傳到 ECP 成功後呼叫，清掉本機暫存檔，避免 uploads/<dirName>/ 累積孤兒檔案。刪除失敗只記 log，不影響流程。
    function removeFile(fileId, logger) {
        const filePath = resolveSafePath(fileId);
        if (!filePath) return;
        fs.unlink(filePath, (err) => {
            if (err) logger && logger.AlertLog(`[UploadMgr:${dirName}] 刪除暫存檔失敗: ${filePath} - ${err.message}`);
        });
    }

    // 依副檔名推斷 Content-Type（僅支援 allowedExt 範圍內的格式）。
    function mimeFromExt(fileNameOrId) {
        const ext = path.extname(String(fileNameOrId || '')).toLowerCase();
        return MIME_BY_EXT[ext] || 'application/octet-stream';
    }

    return {
        arrayUpload: upload.array('files', maxFileCount),
        buildFileRefs,
        readFile,
        removeFile,
        mimeFromExt,
        uploadDir
    };
}

module.exports = { createUploadMgr };
