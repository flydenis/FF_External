const StoreRegion = require('./StoreRegion');

// 會籍資格升等規則（FF-04-01）：依「原卡別（card_name）＋原會員資格（membership）」算出可升選項，
// 送件時再用同一份規則核實。規則只放這一份，前端只顯示外部知識點算好的選項（避免前後端規則不一致）。
// 依據：需求確認規格書 V1.0 p.20–23（代碼對照、19 組有效組合對照表）。

// 卡別代碼與等級：銀卡＝鈦銀卡 < 金卡 < 白金卡。
const CARDS = {
    1: { label: '銀卡', rank: 1 },
    13: { label: '鈦銀卡', rank: 1 },
    4: { label: '金卡', rank: 2 },
    6: { label: '白金卡', rank: 3 }
};
const GOLD = '4';
const PLATINUM = '6';

// 會員資格代碼：1 單館、2–6 各區、7 全國白金。雙區卡代碼未定（規格為未來規劃）。
const REGIONS = { 2: '南區', 3: '中南區', 4: '中區', 5: '中北區', 6: '北區' };
const MEMBERSHIP_SINGLE = '1';
const MEMBERSHIP_NATIONAL = '7';

function cardLabel(cardName) {
    return (CARDS[cardName] && CARDS[cardName].label) || '';
}

function scopeOf(membership) {
    const m = String(membership);
    if (m === MEMBERSHIP_SINGLE) return 'single';
    if (m === MEMBERSHIP_NATIONAL) return 'national';
    return REGIONS[m] ? 'region' : '';
}

// 原資格為單館時，區域取原廠館所在區（假設，待 PM 確認 Q2）；澎湖馬公等不隸屬區域者回 null。
function originRegionOf({ membership, storeCode }) {
    const scope = scopeOf(membership);
    if (scope === 'region') return String(membership);
    if (scope === 'single') {
        const store = StoreRegion[storeCode];
        return store && store.region ? store.region : null;
    }
    return null;
}

function describeCurrent({ cardName, membership, storeCode }) {
    const scope = scopeOf(membership);
    const card = cardLabel(cardName);
    if (scope === 'national') return '全國' + card;
    if (scope === 'region') return `區域${card}（${REGIONS[membership]}）`;
    const store = StoreRegion[storeCode];
    return `單館${card}` + (store ? `（${store.name}）` : '');
}

function makeOption(cardName, scope, region) {
    const card = cardLabel(cardName);
    const option = { code: `${cardName}:${scope}`, cardName: String(cardName), scope, region: region || null, requiresSecondRegion: false };
    if (scope === 'single') option.label = `單館${card}`;
    if (scope === 'region') option.label = `區域${card}（${REGIONS[region]}）`;
    if (scope === 'dual') {
        option.label = `雙區域${card}（${REGIONS[region]}＋另選一區）`;
        option.requiresSecondRegion = true;
        option.secondRegionChoices = Object.keys(REGIONS).filter(r => r !== region).map(r => ({ value: r, label: REGIONS[r] }));
    }
    if (scope === 'national') option.label = '全國白金卡';
    return option;
}

// 回傳可升選項陣列（空陣列＝無可升選項，例如已是全國白金卡）。
// 對照規格 p.22：
//   單館 銀/鈦銀 → 單館金卡、單／雙區域銀・鈦銀卡、單／雙區域金卡、全國白金卡
//   單館 金     → 單／雙區域金卡、全國白金卡
//   單區 銀/鈦銀 → 雙區域銀・鈦銀卡、單／雙區域金卡、全國白金卡
//   單區 金     → 雙區域金卡、全國白金卡
// 「銀・鈦銀卡」選項沿用會員原卡別（銀＝鈦銀同級，互換不算升等）——假設。
// 金卡列在對照表「升等(U)」欄標「—」，但 PM 確認金卡可以升區卡（2026-09-23），故照「升等後適用種類」提供選項。
// regionOverride：轉館加升等用（區域由會員自選，TransferRule 只取「卡別×範圍」組合），升等不傳。
function getUpgradeOptions({ cardName, membership, storeCode, dualRegionEnabled, regionOverride }) {
    const card = String(cardName);
    const scope = scopeOf(membership);
    if (!CARDS[card] || !scope) return [];
    if (scope === 'national' || card === PLATINUM) return [];

    const isSilverTier = CARDS[card].rank === 1;
    const region = regionOverride || originRegionOf({ membership, storeCode });
    const options = [];

    if (scope === 'single') {
        if (isSilverTier) options.push(makeOption(GOLD, 'single'));
        if (region) {
            if (isSilverTier) options.push(makeOption(card, 'region', region));
            options.push(makeOption(GOLD, 'region', region));
        }
    }
    if (scope === 'region' && isSilverTier) options.push(makeOption(GOLD, 'region', region));

    if (dualRegionEnabled && region) {
        if (isSilverTier) options.push(makeOption(card, 'dual', region));
        options.push(makeOption(GOLD, 'dual', region));
    }

    options.push(makeOption(PLATINUM, 'national'));
    return options;
}

// 核實使用者選的選項是否在可升清單內；雙區卡另核實第二區（須為合法區域且不同於第一區）。
// 通過回傳該選項（含 secondRegion），否則回 null。
function validateSelection({ options, code, secondRegion }) {
    const option = (options || []).find(o => o.code === code);
    if (!option) return null;
    if (!option.requiresSecondRegion) return { ...option };
    const second = String(secondRegion || '');
    if (!REGIONS[second] || second === option.region) return null;
    return { ...option, secondRegion: second, label: option.label.replace('另選一區', REGIONS[second]) };
}

// 升等後會員資格代碼（寫 ECP U_UpMembership）：單館 1、區域＝該區代碼、全國 7。
// 雙區卡代碼需求書未定（Q6，目前隱藏不會送出），回 null。
function membershipAfter(option) {
    if (!option) return null;
    if (option.scope === 'single') return MEMBERSHIP_SINGLE;
    if (option.scope === 'region') return option.region ? String(option.region) : null;
    if (option.scope === 'national') return MEMBERSHIP_NATIONAL;
    return null;
}

// 可用分館顯示文字（寫 ECP U_OldAvailableVenue），依《查詢.會籍合約.線上表單及api相關範圍115.07.29》p.8 批註：
// 白金＝全國廠館通用；區卡＝「**區廠館通用」；單館＝廠館名稱。雙館／小三通的資料格式客戶 API 未定，暫同單館。
function availableVenueText({ membership, storeCode }) {
    const scope = scopeOf(membership);
    if (scope === 'national') return '全國廠館通用';
    if (scope === 'region') return `${REGIONS[membership]}廠館通用`;
    if (scope === 'single') {
        const store = StoreRegion[storeCode];
        return store ? store.name : String(storeCode || '');
    }
    return '';
}

function pad(n) { return String(n).padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseISODate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}

// 最早可選啟用日：申請日之後數滿 N 個工作日（不含申請日當天），再往後一天。
// 工作日只排除週六日，國定假日先不排除（2026-09-23 決定）；holidays 清單保留，日後要排除假日時填入即可。例：9/23（三）申請、N=3 → 9/24、9/25、9/28 → 9/29。
function minActivationDate(applyDate, { workingDays = 3, holidays = [] } = {}) {
    const holidaySet = new Set(holidays);
    const d = applyDate instanceof Date ? new Date(applyDate.getFullYear(), applyDate.getMonth(), applyDate.getDate(), 12) : parseISODate(applyDate);
    let counted = 0;
    while (counted < workingDays) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6 && !holidaySet.has(toISODate(d))) counted++;
    }
    d.setDate(d.getDate() + 1);
    return toISODate(d);
}

function isValidActivationDate(actDate, minDate) {
    return !!parseISODate(actDate) && String(actDate) >= String(minDate);
}

module.exports = {
    CARDS,
    REGIONS,
    makeOption,
    cardLabel,
    scopeOf,
    describeCurrent,
    getUpgradeOptions,
    validateSelection,
    membershipAfter,
    availableVenueText,
    minActivationDate,
    isValidActivationDate,
    toISODate
};
