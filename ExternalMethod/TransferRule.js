const StoreRegion = require('./StoreRegion');
const UpgradeRule = require('./UpgradeRule');

// 會籍廠館轉移（T）／廠館轉移加卡別升等（A）規則（FF-04-01 第二階段）。和 UpgradeRule 一樣只放外部知識點一份：
// 可選的新廠館、可選的升等項目都在這裡算好，前端只顯示；送件時用同一份規則再核實。
// 依據：需求確認規格書 p.22–28（轉館可跨區、卡別不動；場館分區清單）、
//       《查詢.會籍合約.線上表單及api相關範圍115.07.29》p.18（轉館）、p.20（轉館加升等：區域 5 選 1 → 縣市 → 館別）。
// 決定（2026-09-29）：新廠館清單不列原廠館（新館別≠原館別），送件時後端再擋一次。

// 可選的新廠館（原廠館除外），依 StoreRegion 的順序（北 → 南，同縣市相鄰）。
// region 有值時只列該區的館；澎湖馬公不隸屬區域、各區區卡皆可用（需求書 p.23），所以任何區域都列。
function venueChoices({ excludeStoreCode, region } = {}) {
    return Object.keys(StoreRegion)
        .filter(code => code !== excludeStoreCode)
        .filter(code => !region || !StoreRegion[code].region || StoreRegion[code].region === String(region))
        .map(code => ({ code, name: StoreRegion[code].name, city: StoreRegion[code].city, region: StoreRegion[code].region }));
}

function isAllowedVenue({ storeCode, excludeStoreCode, region }) {
    return venueChoices({ excludeStoreCode, region }).some(v => v.code === storeCode);
}

// 區域顯示順序照新文件 p.20：北區、中北區、中區、中南區、南區。
const REGION_ORDER = ['6', '5', '4', '3', '2'];

// 轉館加升等可選項目：卡別×範圍的升等規則沿用 UpgradeRule（需求書 p.22 對照表），
// 區域型選項由會員自選區域，每區各一個選項（新文件 p.20）。雙區卡上線前隱藏，這裡不提供（Q6）。
// 選項 code：單館／全國＝「卡別:範圍」，區域＝「卡別:region:區域代碼」。
function getTransferUpgradeOptions({ cardName, membership }) {
    const pairs = UpgradeRule.getUpgradeOptions({ cardName, membership, regionOverride: '6', dualRegionEnabled: false });
    const options = [];
    pairs.forEach(p => {
        if (p.scope !== 'region') { options.push(p); return; }
        REGION_ORDER.forEach(r => {
            const o = UpgradeRule.makeOption(p.cardName, 'region', r);
            options.push({ ...o, code: `${p.cardName}:region:${r}` });
        });
    });
    return options;
}

// 新廠館的縣市、區域（寫 ECP U_TransCity1／U_TransArea1 前還要轉成 ECP 字典值，見 TransferDictMap）。
function venueInfo(storeCode) {
    const s = StoreRegion[storeCode];
    return s ? { code: storeCode, name: s.name, city: s.city, region: s.region } : null;
}

module.exports = { venueChoices, isAllowedVenue, getTransferUpgradeOptions, venueInfo };
