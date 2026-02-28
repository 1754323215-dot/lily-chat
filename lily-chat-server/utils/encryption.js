const crypto = require('crypto');

// 从环境变量获取加密密钥，如果没有则生成一个（仅用于开发）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

/**
 * 加密敏感数据（如身份证号）
 */
function encrypt(text) {
  if (!text) return null;
  
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 返回 iv + encrypted，用 : 分隔
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    // 不在这里记录日志，让调用者处理
    throw new Error('数据加密失败: ' + error.message);
  }
}

/**
 * 解密敏感数据
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('无效的加密数据格式');
    }
    
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // 不在这里记录日志，让调用者处理
    throw new Error('数据解密失败: ' + error.message);
  }
}

module.exports = {
  encrypt,
  decrypt,
  ENCRYPTION_KEY // 导出以便在启动时检查
};

