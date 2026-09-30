// 轉館寫 ECP 用：外部知識點的區域／縣市 → ECP 字典值。
//   U_TransArea1 字典「健身工廠_場館區域」（1a06b7e1-9e60-07c0-7439-00505693a3c1）
//   U_TransCity1 字典「健身工廠_場館縣市」（1a0460cb-77d0-043b-6d18-00505693a3c1），上級字典＝場館區域
//   U_TransNewVenue1 字典「健身工廠_場館館別」：值就是 store_code，與 StoreRegion 一致，不用轉。
// 字典值依 2026-09-29 ECP 執行SQL 查詢結果（!output/程式碼/FF-04-01_查詢轉館字典代碼.sql）。

// key＝會員資格區域代碼（2～6，StoreRegion.region）；澎湖馬公 region 為 null → ECP「F 不分區」。
const AREA = { 6: 'A', 5: 'B', 4: 'C', 3: 'D', 2: 'E' };
const NO_AREA = 'F';

// key＝縣市名稱（StoreRegion.city）；值後面註解是 ECP 字典的上級區域。
const CITY = {
    '基隆市': '1', '宜蘭縣': '2', '台北市': '3', '新北市': '4',   // A 北區
    '桃園市': '5', '新竹市': '6', '新竹縣': '7', '苗栗縣': '8',   // B 中北區
    '台中市': '9', '彰化縣': '10', '南投縣': '11',               // C 中區
    '雲林縣': '12', '嘉義市': '13', '嘉義縣': '14', '台南市': '15', // D 中南區
    '高雄市': '16', '屏東縣': '17',                              // E 南區
    '澎湖縣': '18'                                               // F 不分區
};
// 縣市 → 上級區域（ECP 字典的 ParentValue），供測試核對 StoreRegion 的區域是否與 ECP 一致。
const CITY_AREA = {
    '基隆市': 'A', '宜蘭縣': 'A', '台北市': 'A', '新北市': 'A',
    '桃園市': 'B', '新竹市': 'B', '新竹縣': 'B', '苗栗縣': 'B',
    '台中市': 'C', '彰化縣': 'C', '南投縣': 'C',
    '雲林縣': 'D', '嘉義市': 'D', '嘉義縣': 'D', '台南市': 'D',
    '高雄市': 'E', '屏東縣': 'E',
    '澎湖縣': 'F'
};

module.exports = {
    AREA, CITY, CITY_AREA,
    areaValue: region => (region ? AREA[region] || null : NO_AREA),
    cityValue: city => (city && CITY[city]) || null
};
