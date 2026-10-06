const UpgradeRule = require('./UpgradeRule');

// 學生寒暑假限定轉館（FF-04-02）期間規則：純函式，「今天」一律由參數傳入，方便單元測試任意日期。
//   期間（period）＝ { name, openFrom, openTo, actFrom, actTo }，皆為 YYYY-MM-DD：
//     openFrom～openTo：開放顯示「學生寒暑假轉館」按鈕的期間；actFrom～actTo：啟用日可選範圍（不得跨寒暑假區間）。
//   期間以 ECP 參數單元為準（健工自行調整）；讀不到時用 ExternalConfig 的預設值（月-日），由 expandDefaultPeriods 展開成實際日期。
//   轉出新廠館（Y）：啟用日 ＝ 申請日 +N 工作日起、不得晚於期末；轉回原廠館（O）：只限申請日 +N 工作日之後，沒有最晚日（2026-10-06 定案）。

function lastDayOfFeb(year) {
    return new Date(year, 2, 0).getDate();
}

// 'MM-DD' ＋ 年 → 'YYYY-MM-DD'；02-29 在非閏年改成 2 月最後一天（2026-10-05 定案）。
function monthDayToDate(year, md) {
    const m = /^(\d{2})-(\d{2})$/.exec(String(md || ''));
    if (!m) return null;
    let day = Number(m[2]);
    if (m[1] === '02' && day > lastDayOfFeb(year)) day = lastDayOfFeb(year);
    return `${year}-${m[1]}-${String(day).padStart(2, '0')}`;
}

// 預設期間（月-日）展開成前一年、今年、明年三份實際日期，涵蓋跨年開放（例：12 月就開放申請寒假）。
function expandDefaultPeriods(defaults, today) {
    const year = Number(String(today).slice(0, 4));
    const result = [];
    for (const y of [year - 1, year, year + 1]) {
        for (const p of (defaults || [])) {
            // 開放起日晚於啟用迄日（跨年開放）時，開放起日算前一年。
            const openYear = String(p.openFrom) > String(p.actTo) ? y - 1 : y;
            result.push({
                name: `${y} ${p.name || ''}`.trim(),
                openFrom: monthDayToDate(openYear, p.openFrom),
                openTo: monthDayToDate(y, p.openTo),
                actFrom: monthDayToDate(y, p.actFrom),
                actTo: monthDayToDate(y, p.actTo)
            });
        }
    }
    return result.filter(isValidPeriod);
}

// ECP 日期可能是 'YYYY-MM-DD'、'YYYY-MM-DD HH:mm:ss'、'YYYY/MM/DD' 或毫秒數，統一成 'YYYY-MM-DD'；認不得回 null。
function normalizeDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return UpgradeRule.toISODate(new Date(v));
    const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(v).trim());
    return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
}

function isValidPeriod(p) {
    return !!(p && p.openFrom && p.openTo && p.actFrom && p.actTo && p.openFrom <= p.openTo && p.actFrom <= p.actTo);
}

// 今天落在哪個開放期間；多筆重疊時取啟用迄日最早的（先到期的先處理）。不在任何期間回 null。
function findOpenPeriod(today, periods) {
    const hits = (periods || []).filter(p => isValidPeriod(p) && p.openFrom <= today && today <= p.openTo);
    hits.sort((a, b) => (a.actTo < b.actTo ? -1 : a.actTo > b.actTo ? 1 : 0));
    return hits[0] || null;
}

// 可選啟用日範圍 { min, max }（max 為 null＝不限）；Y 沒有可選日回 null。
function activationRange({ today, studentType, period, workingDays = 3, holidays = [] }) {
    const earliest = UpgradeRule.minActivationDate(today, { workingDays, holidays });
    if (studentType === 'O') return { min: earliest, max: null };
    if (studentType !== 'Y' || !isValidPeriod(period)) return null;
    const min = earliest > period.actFrom ? earliest : period.actFrom;
    return min <= period.actTo ? { min, max: period.actTo } : null;
}

function isValidActivation(actDate, range) {
    if (!range || !UpgradeRule.isValidActivationDate(actDate, range.min)) return false;
    return !range.max || String(actDate) <= range.max;
}

module.exports = {
    lastDayOfFeb,
    monthDayToDate,
    expandDefaultPeriods,
    normalizeDate,
    isValidPeriod,
    findOpenPeriod,
    activationRange,
    isValidActivation
};
