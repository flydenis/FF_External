// 學生寒暑假轉館期間規則單元測試（FF-04-02）。
// 跑法：node test/studentTransferRule.test.js（npm run verify 會一併執行）。
const assert = require('assert');
const R = require('../ExternalMethod/StudentTransferRule');

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); pass++; console.log(`  [PASS] ${name}`); }
    catch (e) { fail++; console.log(`  [FAIL] ${name} — ${e.message}`); }
}

// 與 ExternalConfig.ChangeMembership.Student.DefaultPeriods 相同的預設值
const DEFAULTS = [
    { name: '寒假', openFrom: '01-01', openTo: '02-29', actFrom: '01-01', actTo: '02-29' },
    { name: '暑假', openFrom: '07-01', openTo: '09-30', actFrom: '07-01', actTo: '09-30' }
];
const periodOn = today => R.findOpenPeriod(today, R.expandDefaultPeriods(DEFAULTS, today));
const rangeOn = (today, studentType) => R.activationRange({ today, studentType, period: periodOn(today) });

console.log('\n=== 學生寒暑假轉館期間規則（StudentTransferRule）===');

// 2/29 換算
t('2027 非閏年：2 月最後一天＝28', () => assert.strictEqual(R.lastDayOfFeb(2027), 28));
t('2028 閏年：2 月最後一天＝29', () => assert.strictEqual(R.lastDayOfFeb(2028), 29));
t('02-29 在 2027 → 2027-02-28', () => assert.strictEqual(R.monthDayToDate(2027, '02-29'), '2027-02-28'));
t('02-29 在 2028 → 2028-02-29', () => assert.strictEqual(R.monthDayToDate(2028, '02-29'), '2028-02-29'));

// 開放期間
t('10/6 不在開放期間', () => assert.strictEqual(periodOn('2026-10-06'), null));
t('11/30 不在開放期間', () => assert.strictEqual(periodOn('2026-11-30'), null));
t('5/31 不在開放期間', () => assert.strictEqual(periodOn('2027-05-31'), null));
t('1/1 在寒假期間，啟用迄日 2027-02-28', () => {
    const p = periodOn('2027-01-01');
    assert.strictEqual(p.actFrom, '2027-01-01'); assert.strictEqual(p.actTo, '2027-02-28');
});
t('2028-02-29 閏年當天仍在期間', () => assert.strictEqual(periodOn('2028-02-29').actTo, '2028-02-29'));
t('7/1、9/30 在暑假期間', () => {
    assert.strictEqual(periodOn('2027-07-01').actTo, '2027-09-30');
    assert.strictEqual(periodOn('2027-09-30').actFrom, '2027-07-01');
});
t('跨年開放：12/1 開始開放寒假 → 12/10 屬 2027 寒假', () => {
    const p = R.findOpenPeriod('2026-12-10', R.expandDefaultPeriods([{ name: '寒假', openFrom: '12-01', openTo: '02-29', actFrom: '01-01', actTo: '02-29' }], '2026-12-10'));
    assert.strictEqual(p.openFrom, '2026-12-01'); assert.strictEqual(p.actFrom, '2027-01-01'); assert.strictEqual(p.actTo, '2027-02-28');
});

// ECP 參數（完整日期）
t('ECP 日期格式轉換', () => {
    assert.strictEqual(R.normalizeDate('2027-01-01 00:00:00'), '2027-01-01');
    assert.strictEqual(R.normalizeDate('2027/7/1'), '2027-07-01');
    assert.strictEqual(R.normalizeDate(''), null);
    assert.strictEqual(R.normalizeDate('abc'), null);
});
t('ECP 期間：開放 12/1–2/28、啟用 1/1–2/28', () => {
    const p = R.findOpenPeriod('2026-12-15', [{ name: '2027 寒假', openFrom: '2026-12-01', openTo: '2027-02-28', actFrom: '2027-01-01', actTo: '2027-02-28' }]);
    assert.strictEqual(p.name, '2027 寒假');
});
t('起迄顛倒的期間視為無效', () => assert.strictEqual(R.findOpenPeriod('2027-01-10', [{ openFrom: '2027-02-01', openTo: '2027-01-01', actFrom: '2027-01-01', actTo: '2027-02-28' }]), null));

// 轉出（Y）啟用日
t('Y：7/10（六）申請 → 最早 7/15、最晚 9/30', () => assert.deepStrictEqual(rangeOn('2027-07-10', 'Y'), { min: '2027-07-15', max: '2027-09-30' }));
t('Y：1/1（五）申請 → 最早 1/7、最晚 2/28', () => assert.deepStrictEqual(rangeOn('2027-01-01', 'Y'), { min: '2027-01-07', max: '2027-02-28' }));
t('Y：開放早於啟用（12/10 申請）→ 最早＝啟用起日 1/1', () => {
    const period = { openFrom: '2026-12-01', openTo: '2027-02-28', actFrom: '2027-01-01', actTo: '2027-02-28' };
    assert.deepStrictEqual(R.activationRange({ today: '2026-12-10', studentType: 'Y', period }), { min: '2027-01-01', max: '2027-02-28' });
});
t('Y：2027-02-24（三）申請 → 最早 3/2 已超過 2/28 → 無可選日', () => assert.strictEqual(rangeOn('2027-02-24', 'Y'), null));
t('Y：2028-02-23（三）申請（閏年）→ 最早 2/29、最晚 2/29', () => assert.deepStrictEqual(rangeOn('2028-02-23', 'Y'), { min: '2028-02-29', max: '2028-02-29' }));
t('Y：9/24（五）申請 → 只剩期末 9/30 可選', () => assert.deepStrictEqual(rangeOn('2027-09-24', 'Y'), { min: '2027-09-30', max: '2027-09-30' }));
t('Y：9/27（一）申請 → 最早 10/1 已超過 9/30 → 無可選日', () => assert.strictEqual(rangeOn('2027-09-27', 'Y'), null));

// 轉回（O）啟用日
t('O：9/24（五）申請 → 最早 9/30、不限最晚', () => assert.deepStrictEqual(rangeOn('2027-09-24', 'O'), { min: '2027-09-30', max: null }));
t('O：2/24 申請 → 最早 3/2（可超過寒假期末）', () => assert.deepStrictEqual(rangeOn('2027-02-24', 'O'), { min: '2027-03-02', max: null }));
t('未知類型 → null', () => assert.strictEqual(rangeOn('2027-07-10', 'X'), null));

// 送件核實
t('核實：範圍內通過、期末當天通過', () => {
    const r = { min: '2027-07-15', max: '2027-09-30' };
    assert.strictEqual(R.isValidActivation('2027-07-15', r), true);
    assert.strictEqual(R.isValidActivation('2027-09-30', r), true);
});
t('核實：早於最早日、晚於期末、格式錯誤都不通過', () => {
    const r = { min: '2027-07-15', max: '2027-09-30' };
    assert.strictEqual(R.isValidActivation('2027-07-14', r), false);
    assert.strictEqual(R.isValidActivation('2027-10-01', r), false);
    assert.strictEqual(R.isValidActivation('2027/07/20', r), false);
});
t('核實：O 不限最晚日', () => assert.strictEqual(R.isValidActivation('2028-01-01', { min: '2027-09-30', max: null }), true));
t('核實：沒有範圍不通過', () => assert.strictEqual(R.isValidActivation('2027-07-20', null), false));

console.log(`\n結果：${pass} 過 / ${fail} 失敗\n`);
module.exports = { pass, fail };
if (require.main === module) process.exit(fail ? 1 : 0);
