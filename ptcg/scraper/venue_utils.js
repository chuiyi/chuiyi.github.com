'use strict';

// 台灣縣市清單（輸出統一用「臺」，與官方賽事積分資料 area 欄位一致）。
// 比對時「台」「臺」兩種寫法皆接受。
const TAIWAN_REGIONS = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
];

function deriveCityFromAddress(address) {
  const text = String(address || '').replace(/台/g, '臺');
  for (const region of TAIWAN_REGIONS) {
    if (text.includes(region)) return region;
  }
  return '';
}

// 從官方賽事頁面（asia.pokemon-card.com/tw/event-search/{id}/）擷取會場名稱與地址。
// $ 為已載入該頁 HTML 的 cheerio 實例。
function extractVenueAndAddress($) {
  const placeSection = $('section.mainSection.place').first();
  if (placeSection.length) {
    const lines = placeSection
      .find('div')
      .map((_, el) => String($(el).text() || '').replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);

    if (lines.length >= 2) {
      const venueText = lines[lines.length - 1];
      const maybePostal = lines[0];
      const hasPostal = /^\d{3,5}$/.test(maybePostal);
      const cityText = lines[lines.length - 2];

      const addressParts = [];
      if (hasPostal) addressParts.push(maybePostal);
      if (cityText && !venueText.includes(cityText)) addressParts.push(cityText);
      addressParts.push(venueText);

      return { venue: venueText, address: addressParts.join(' ').trim() };
    }

    if (lines.length === 1) {
      return { venue: lines[0], address: lines[0] };
    }
  }

  // 回退：若站方 DOM 結構改版，再使用純文字模式嘗試擷取。
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const venueMatch = bodyText.match(/會場\s+(.+?)\s+(?:報名|主辦方情報|活動概要|地址)/);
  const addressMatch = bodyText.match(/地址\s+(.+?)\s+(?:參加費|人數限制|同意事項|活動概要|報名|主辦方情報)/);

  return {
    venue: venueMatch ? String(venueMatch[1] || '').trim() : '',
    address: addressMatch ? String(addressMatch[1] || '').trim() : '',
  };
}

module.exports = { TAIWAN_REGIONS, deriveCityFromAddress, extractVenueAndAddress };
