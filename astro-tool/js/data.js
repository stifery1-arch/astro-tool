/*!
 * data.js —— 城市经纬度 + 时区数据
 * 格式: [城市名, 纬度(北正), 经度(东正), IANA时区]
 * 时区支持历史夏令时（如中国 1986-1991 年夏令时、欧美 DST）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroData = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SH = 'Asia/Shanghai';
  /* 中国城市已迁移到 data-cn.js（全国省市区完整数据） */
  var WORLD = [
    ['东京', 35.6762, 139.6503, 'Asia/Tokyo'], ['大阪', 34.6937, 135.5023, 'Asia/Tokyo'],
    ['京都', 35.0116, 135.7681, 'Asia/Tokyo'], ['首尔', 37.5665, 126.9780, 'Asia/Seoul'],
    ['釜山', 35.1796, 129.0756, 'Asia/Seoul'], ['新加坡', 1.3521, 103.8198, 'Asia/Singapore'],
    ['吉隆坡', 3.1390, 101.6869, 'Asia/Kuala_Lumpur'], ['曼谷', 13.7563, 100.5018, 'Asia/Bangkok'],
    ['雅加达', -6.2088, 106.8456, 'Asia/Jakarta'], ['马尼拉', 14.5995, 120.9842, 'Asia/Manila'],
    ['河内', 21.0278, 105.8342, 'Asia/Ho_Chi_Minh'], ['胡志明市', 10.8231, 106.6297, 'Asia/Ho_Chi_Minh'],
    ['新德里', 28.6139, 77.2090, 'Asia/Kolkata'], ['孟买', 19.0760, 72.8777, 'Asia/Kolkata'],
    ['加德满都', 27.7172, 85.3240, 'Asia/Kathmandu'], ['迪拜', 25.2048, 55.2708, 'Asia/Dubai'],
    ['伊斯坦布尔', 41.0082, 28.9784, 'Europe/Istanbul'], ['莫斯科', 55.7558, 37.6173, 'Europe/Moscow'],
    ['伦敦', 51.5074, -0.1278, 'Europe/London'], ['巴黎', 48.8566, 2.3522, 'Europe/Paris'],
    ['柏林', 52.5200, 13.4050, 'Europe/Berlin'], ['慕尼黑', 48.1351, 11.5820, 'Europe/Berlin'],
    ['阿姆斯特丹', 52.3676, 4.9041, 'Europe/Amsterdam'], ['布鲁塞尔', 50.8503, 4.3517, 'Europe/Brussels'],
    ['罗马', 41.9028, 12.4964, 'Europe/Rome'], ['米兰', 45.4642, 9.1900, 'Europe/Rome'],
    ['马德里', 40.4168, -3.7038, 'Europe/Madrid'], ['巴塞罗那', 41.3874, 2.1686, 'Europe/Madrid'],
    ['里斯本', 38.7223, -9.1393, 'Europe/Lisbon'], ['苏黎世', 47.3769, 8.5417, 'Europe/Zurich'],
    ['维也纳', 48.2082, 16.3738, 'Europe/Vienna'], ['斯德哥尔摩', 59.3293, 18.0686, 'Europe/Stockholm'],
    ['奥斯陆', 59.9139, 10.7522, 'Europe/Oslo'], ['哥本哈根', 55.6761, 12.5683, 'Europe/Copenhagen'],
    ['赫尔辛基', 60.1699, 24.9384, 'Europe/Helsinki'], ['雅典', 37.9838, 23.7275, 'Europe/Athens'],
    ['华沙', 52.2297, 21.0122, 'Europe/Warsaw'], ['布拉格', 50.0755, 14.4378, 'Europe/Prague'],
    ['基辅', 50.4501, 30.5234, 'Europe/Kiev'], ['纽约', 40.7128, -74.0060, 'America/New_York'],
    ['洛杉矶', 34.0522, -118.2437, 'America/Los_Angeles'], ['旧金山', 37.7749, -122.4194, 'America/Los_Angeles'],
    ['西雅图', 47.6062, -122.3321, 'America/Los_Angeles'], ['拉斯维加斯', 36.1699, -115.1398, 'America/Los_Angeles'],
    ['芝加哥', 41.8781, -87.6298, 'America/Chicago'], ['休斯顿', 29.7604, -95.3698, 'America/Chicago'],
    ['达拉斯', 32.7767, -96.7970, 'America/Chicago'], ['波士顿', 42.3601, -71.0589, 'America/New_York'],
    ['华盛顿', 38.9072, -77.0369, 'America/New_York'], ['迈阿密', 25.7617, -80.1918, 'America/New_York'],
    ['亚特兰大', 33.7490, -84.3880, 'America/New_York'], ['多伦多', 43.6532, -79.3832, 'America/Toronto'],
    ['温哥华', 49.2827, -123.1207, 'America/Vancouver'], ['蒙特利尔', 45.5017, -73.5673, 'America/Toronto'],
    ['墨西哥城', 19.4326, -99.1332, 'America/Mexico_City'], ['圣保罗', -23.5505, -46.6333, 'America/Sao_Paulo'],
    ['里约热内卢', -22.9068, -43.1729, 'America/Sao_Paulo'], ['布宜诺斯艾利斯', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'],
    ['利马', -12.0464, -77.0428, 'America/Lima'], ['圣地亚哥', -33.4489, -70.6693, 'America/Santiago'],
    ['悉尼', -33.8688, 151.2093, 'Australia/Sydney'], ['墨尔本', -37.8136, 144.9631, 'Australia/Melbourne'],
    ['布里斯班', -27.4698, 153.0251, 'Australia/Brisbane'], ['珀斯', -31.9505, 115.8605, 'Australia/Perth'],
    ['奥克兰', -36.8485, 174.7633, 'Pacific/Auckland'], ['开罗', 30.0444, 31.2357, 'Africa/Cairo'],
    ['约翰内斯堡', -26.2041, 28.0473, 'Africa/Johannesburg'], ['内罗毕', -1.2921, 36.8219, 'Africa/Nairobi'],
    ['拉各斯', 6.5244, 3.3792, 'Africa/Lagos'], ['卡萨布兰卡', 33.5731, -7.5898, 'Africa/Casablanca']
  ];

  var CITIES = WORLD.map(function (c) {
    return { name: c[0], lat: c[1], lon: c[2], tz: c[3], country: '' };
  });

  var ZONES = [
    ['Asia/Shanghai', '中国标准时间 UTC+8（含历史夏令时）'],
    ['Asia/Hong_Kong', '香港 UTC+8'],
    ['Asia/Macau', '澳门 UTC+8'],
    ['Asia/Taipei', '台北 UTC+8'],
    ['Asia/Tokyo', '日本 UTC+9'],
    ['Asia/Seoul', '韩国 UTC+9'],
    ['Asia/Singapore', '新加坡 UTC+8'],
    ['Asia/Kuala_Lumpur', '马来西亚 UTC+8'],
    ['Asia/Bangkok', '泰国 UTC+7'],
    ['Asia/Jakarta', '印尼西部 UTC+7'],
    ['Asia/Manila', '菲律宾 UTC+8'],
    ['Asia/Ho_Chi_Minh', '越南 UTC+7'],
    ['Asia/Kolkata', '印度 UTC+5:30'],
    ['Asia/Kathmandu', '尼泊尔 UTC+5:45'],
    ['Asia/Dubai', '阿联酋 UTC+4'],
    ['Asia/Karachi', '巴基斯坦 UTC+5'],
    ['Asia/Riyadh', '沙特 UTC+3'],
    ['Europe/Istanbul', '土耳其 UTC+3'],
    ['Europe/Moscow', '莫斯科 UTC+3'],
    ['Europe/London', '英国 UTC+0 / 夏令时 +1'],
    ['Europe/Paris', '法国/德国 UTC+1 / 夏令时 +2'],
    ['Europe/Berlin', '柏林 UTC+1 / 夏令时 +2'],
    ['Europe/Amsterdam', '荷兰 UTC+1 / 夏令时 +2'],
    ['Europe/Brussels', '比利时 UTC+1 / 夏令时 +2'],
    ['Europe/Rome', '意大利 UTC+1 / 夏令时 +2'],
    ['Europe/Madrid', '西班牙 UTC+1 / 夏令时 +2'],
    ['Europe/Lisbon', '葡萄牙 UTC+0 / 夏令时 +1'],
    ['Europe/Zurich', '瑞士 UTC+1 / 夏令时 +2'],
    ['Europe/Vienna', '奥地利 UTC+1 / 夏令时 +2'],
    ['Europe/Prague', '捷克 UTC+1 / 夏令时 +2'],
    ['Europe/Warsaw', '波兰 UTC+1 / 夏令时 +2'],
    ['Europe/Stockholm', '瑞典 UTC+1 / 夏令时 +2'],
    ['Europe/Oslo', '挪威 UTC+1 / 夏令时 +2'],
    ['Europe/Copenhagen', '丹麦 UTC+1 / 夏令时 +2'],
    ['Europe/Helsinki', '芬兰 UTC+2 / 夏令时 +3'],
    ['Europe/Athens', '希腊 UTC+2 / 夏令时 +3'],
    ['Europe/Kiev', '乌克兰 UTC+2 / 夏令时 +3'],
    ['America/New_York', '美东 UTC-5 / 夏令时 -4'],
    ['America/Chicago', '美中 UTC-6 / 夏令时 -5'],
    ['America/Denver', '美山 UTC-7 / 夏令时 -6'],
    ['America/Los_Angeles', '美西 UTC-8 / 夏令时 -7'],
    ['America/Phoenix', '亚利桑那 UTC-7（无夏令时）'],
    ['America/Anchorage', '阿拉斯加 UTC-9 / 夏令时 -8'],
    ['Pacific/Honolulu', '夏威夷 UTC-10（无夏令时）'],
    ['America/Toronto', '加拿大多伦多 UTC-5 / 夏令时 -4'],
    ['America/Vancouver', '加拿大温哥华 UTC-8 / 夏令时 -7'],
    ['America/Mexico_City', '墨西哥城 UTC-6'],
    ['America/Sao_Paulo', '巴西圣保罗 UTC-3'],
    ['America/Argentina/Buenos_Aires', '阿根廷 UTC-3'],
    ['America/Santiago', '智利 UTC-4 / 夏令时 -3'],
    ['America/Lima', '秘鲁 UTC-5'],
    ['Australia/Sydney', '澳洲悉尼 UTC+10 / 夏令时 +11'],
    ['Australia/Melbourne', '澳洲墨尔本 UTC+10 / 夏令时 +11'],
    ['Australia/Brisbane', '澳洲布里斯班 UTC+10'],
    ['Australia/Perth', '澳洲珀斯 UTC+8'],
    ['Pacific/Auckland', '新西兰 UTC+12 / 夏令时 +13'],
    ['Africa/Cairo', '埃及 UTC+2'],
    ['Africa/Johannesburg', '南非 UTC+2'],
    ['Africa/Lagos', '尼日利亚 UTC+1'],
    ['Africa/Nairobi', '肯尼亚 UTC+3'],
    ['Africa/Casablanca', '摩洛哥 UTC+1'],
    ['UTC', '世界标准时间 UTC+0']
  ].map(function (z) { return { zone: z[0], label: z[1] }; });

  function search(keyword) {
    var k = (keyword || '').trim().toLowerCase();
    if (!k) return CITIES.slice(0, 30);
    return CITIES.filter(function (c) {
      return c.name.indexOf(k) >= 0 || c.name.toLowerCase().indexOf(k) >= 0 || c.tz.toLowerCase().indexOf(k) >= 0;
    }).slice(0, 40);
  }
  function byName(name) {
    for (var i = 0; i < CITIES.length; i++) { if (CITIES[i].name === name) return CITIES[i]; }
    return null;
  }

  return { CITIES: CITIES, ZONES: ZONES, search: search, byName: byName };
});