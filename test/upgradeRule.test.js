// 升等規則單元測試：對照需求書 p.22「19 組有效組合對照表」的「升等後適用種類」欄。
// 跑法：node test/upgradeRule.test.js（npm run verify 會一併執行）。
const assert = require('assert');
const R = require('../ExternalMethod/UpgradeRule');

const codes = args => R.getUpgradeOptions(args).map(o => o.code);
let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); pass++; console.log(`  [PASS] ${name}`); }
    catch (e) { fail++; console.log(`  [FAIL] ${name} — ${e.message}`); }
}

console.log('\n=== 升等規則（UpgradeRule）===');

// 單館（屏東潮州 PW046 → 南區 2）
t('單館銀卡 → 單館金卡、區域銀卡、區域金卡、全國白金', () =>
    assert.deepStrictEqual(codes({ cardName: '1', membership: '1', storeCode: 'PW046' }), ['4:single', '1:region', '4:region', '6:national']));
t('單館鈦銀卡 → 區域選項沿用鈦銀卡', () =>
    assert.deepStrictEqual(codes({ cardName: '13', membership: '1', storeCode: 'PW046' }), ['4:single', '13:region', '4:region', '6:national']));
t('單館金卡 → 區域金卡、全國白金', () =>
    assert.deepStrictEqual(codes({ cardName: '4', membership: '1', storeCode: 'PW046' }), ['4:region', '6:national']));
t('單館區域取原廠館所在區（屏東潮州＝南區）', () =>
    assert.strictEqual(R.getUpgradeOptions({ cardName: '4', membership: '1', storeCode: 'PW046' })[0].region, '2'));

// 單區
t('區域銀卡 → 區域金卡、全國白金（雙區隱藏時）', () =>
    assert.deepStrictEqual(codes({ cardName: '1', membership: '6', storeCode: 'PX001' }), ['4:region', '6:national']));
t('區域金卡 → 全國白金（雙區隱藏時）', () =>
    assert.deepStrictEqual(codes({ cardName: '4', membership: '2', storeCode: 'PW066' }), ['6:national']));
t('區域銀卡升區域金卡時鎖定原區（中南區）', () =>
    assert.strictEqual(R.getUpgradeOptions({ cardName: '1', membership: '3', storeCode: 'PW013' })[0].region, '3'));

// 雙區開啟
t('雙區開啟：單館銀卡多出雙區銀卡、雙區金卡', () =>
    assert.deepStrictEqual(codes({ cardName: '1', membership: '1', storeCode: 'PW046', dualRegionEnabled: true }),
        ['4:single', '1:region', '4:region', '1:dual', '4:dual', '6:national']));
t('雙區開啟：區域金卡 → 雙區金卡、全國白金', () =>
    assert.deepStrictEqual(codes({ cardName: '4', membership: '2', storeCode: 'PW066', dualRegionEnabled: true }), ['4:dual', '6:national']));

// 不可升／特殊
t('全國白金卡 → 無可升選項', () =>
    assert.deepStrictEqual(codes({ cardName: '6', membership: '7', storeCode: 'PW007' }), []));
t('澎湖馬公單館鈦銀卡 → 無區域選項（只剩單館金卡、全國白金）', () =>
    assert.deepStrictEqual(codes({ cardName: '13', membership: '1', storeCode: 'PW086', dualRegionEnabled: true }), ['4:single', '6:national']));
t('未知代碼 → 無可升選項', () =>
    assert.deepStrictEqual(codes({ cardName: '99', membership: '1', storeCode: 'PW046' }), []));

// 核實
const opts = R.getUpgradeOptions({ cardName: '1', membership: '1', storeCode: 'PW046', dualRegionEnabled: true });
t('核實：清單內選項通過', () => assert.ok(R.validateSelection({ options: opts, code: '4:region' })));
t('核實：清單外選項（降級）不通過', () => assert.strictEqual(R.validateSelection({ options: opts, code: '1:single' }), null));
t('核實：雙區第二區與第一區相同不通過', () => assert.strictEqual(R.validateSelection({ options: opts, code: '4:dual', secondRegion: '2' }), null));
t('核實：雙區第二區不同則通過且標示兩區', () => {
    const s = R.validateSelection({ options: opts, code: '4:dual', secondRegion: '6' });
    assert.ok(s && s.label.includes('南區') && s.label.includes('北區'));
});

// 啟用日
t('啟用日：9/23（三）申請 → 最早 9/29（二）', () => assert.strictEqual(R.minActivationDate('2026-09-23'), '2026-09-29'));
t('啟用日：9/25 放假 → 最早 9/30（三）', () => assert.strictEqual(R.minActivationDate('2026-09-23', { holidays: ['2026-09-25'] }), '2026-09-30'));
t('啟用日：週五申請 → 跳過週末', () => assert.strictEqual(R.minActivationDate('2026-09-25'), '2026-10-01'));
t('啟用日：早於最早日不通過', () => assert.strictEqual(R.isValidActivationDate('2026-09-28', '2026-09-29'), false));
t('啟用日：等於最早日通過', () => assert.strictEqual(R.isValidActivationDate('2026-09-29', '2026-09-29'), true));
t('啟用日：格式錯誤不通過', () => assert.strictEqual(R.isValidActivationDate('2026/09/29', '2026-09-29'), false));

console.log(`\n結果：${pass} 過 / ${fail} 失敗\n`);
module.exports = { pass, fail };
if (require.main === module) process.exit(fail ? 1 : 0);
