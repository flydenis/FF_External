// 轉館寫 ECP 用：外部知識點的區域／縣市 → ECP 字典值。
//   U_TransArea1 字典「健身工廠_場館區域」（1a06b7e1-9e60-07c0-7439-00505693a3c1）
//   U_TransCity1 字典「健身工廠_場館縣市」（1a0460cb-77d0-043b-6d18-00505693a3c1）
//   U_TransNewVenue1 字典「健身工廠_場館館別」：值就是 store_code，與 StoreRegion 一致，不用轉。
// TODO(待查 ECP 字典)：區域、縣市的字典值還沒查（!output/程式碼/FF-04-01_查詢轉館字典代碼.sql），
// 查到前兩張表留空，不送這兩欄（只送館別）。填法：AREA 的 key＝會員資格區域代碼（2～6），CITY 的 key＝縣市名稱。
const AREA = {};
const CITY = {};

module.exports = {
    areaValue: region => (region && AREA[region]) || null,
    cityValue: city => (city && CITY[city]) || null
};
