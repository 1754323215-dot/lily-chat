const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * 清理用户输入，防止 XSS 攻击
 * @param {string} dirty - 未清理的文本
 * @param {boolean} allowHTML - 是否允许 HTML（默认 false，只保留纯文本）
 * @returns {string} 清理后的文本
 */
function sanitize(dirty, allowHTML = false) {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  if (allowHTML) {
    // 允许基本 HTML，但清理危险内容
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href']
    });
  } else {
    // 只保留纯文本，移除所有 HTML
    return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
  }
}

/**
 * 清理对象中的所有字符串字段
 */
function sanitizeObject(obj, allowHTML = false) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, allowHTML));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitize(value, allowHTML);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, allowHTML);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

module.exports = {
  sanitize,
  sanitizeObject
};

