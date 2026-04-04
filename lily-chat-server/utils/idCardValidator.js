/**
 * 中国大陆居民身份证格式校验（18 位校验位 + 出生日期；15 位老证仅结构/日期粗检）
 * 不调用外部实名 API，无法核验「证号与公安部是否一致」。
 */

function normalizeIdCard(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

function isValidDateYYYYMMDD(ymd) {
  if (!ymd || ymd.length !== 8) return false;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  const nowY = new Date().getFullYear();
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 1900 || y > nowY) return false;
  if (m < 1 || m > 12) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** 15 位老证：6 位地区 + 6 位出生 yyMMdd + 3 位顺序 */
function validate15(id) {
  if (!/^[1-9]\d{14}$/.test(id)) return false;
  const yy = Number(id.slice(6, 8));
  const mm = Number(id.slice(8, 10));
  const dd = Number(id.slice(10, 12));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  // 不强行转公历世纪（yy 模糊），只做范围粗检
  if (yy < 0 || yy > 99) return false;
  return true;
}

/** 18 位：地区 + 出生 + 顺序 + 校验码 */
function validate18(id) {
  if (!/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9X]$/.test(id)) {
    return false;
  }
  const ymd = id.slice(6, 14);
  if (!isValidDateYYYYMMDD(ymd)) return false;

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = '10X98765432';
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += Number(id[i], 10) * weights[i];
  }
  const expected = checkCodes[sum % 11];
  return id[17] === expected;
}

function isValidChineseIdCard(id) {
  const s = normalizeIdCard(id);
  if (s.length === 18) return validate18(s);
  if (s.length === 15) return validate15(s);
  return false;
}

module.exports = {
  normalizeIdCard,
  isValidChineseIdCard,
};
