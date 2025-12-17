// 标签数据模型
// 用于定义用户身份标签的结构和类型

/**
 * 标签类型
 * - required: 必认证标签（现在单位：公司或学校）
 * - optional: 可认证标签（曾所属单位）
 * - custom: 用户自定义标签
 */
export const TAG_TYPES = {
  REQUIRED: 'required',    // 必认证：现在单位
  OPTIONAL: 'optional',    // 可认证：曾所属单位
  CUSTOM: 'custom',        // 自定义标签
};

/**
 * 标签级别
 * - level 1: 未认证标签（用户自己添加，未经过客服认证）
 * - level 2: 已认证标签（经过客服审核认证）
 */
export const TAG_LEVELS = {
  UNVERIFIED: 1,  // 未认证
  VERIFIED: 2,    // 已认证
};

/**
 * 标签数据结构
 * @typedef {Object} Tag
 * @property {number} id - 标签ID
 * @property {string} name - 标签名称
 * @property {string} type - 标签类型 (required/optional/custom)
 * @property {number} level - 标签级别 (1=未认证, 2=已认证)
 * @property {boolean} verified - 是否已认证
 * @property {string} [proof] - 认证证明（图片URL或文档）
 * @property {Date} [verifiedAt] - 认证时间
 * @property {string} [verifiedBy] - 认证客服ID
 */

/**
 * 创建标签对象
 */
export function createTag(name, type = TAG_TYPES.CUSTOM, level = TAG_LEVELS.UNVERIFIED) {
  return {
    id: Date.now(), // 临时ID，实际应从后端获取
    name,
    type,
    level,
    verified: level === TAG_LEVELS.VERIFIED,
    proof: null,
    verifiedAt: level === TAG_LEVELS.VERIFIED ? new Date() : null,
    verifiedBy: null,
  };
}

/**
 * 验证标签数据
 */
export function validateTag(tag) {
  if (!tag.name || tag.name.trim().length === 0) {
    return { valid: false, error: '标签名称不能为空' };
  }
  if (tag.name.length > 20) {
    return { valid: false, error: '标签名称不能超过20个字符' };
  }
  if (!Object.values(TAG_TYPES).includes(tag.type)) {
    return { valid: false, error: '无效的标签类型' };
  }
  return { valid: true };
}

