const logger = require('./logger');
const { isValidChineseIdCard, normalizeIdCard } = require('./idCardValidator');

/**
 * 腾讯云人脸核身 - 身份证二要素核验（姓名 + 身份证号）
 * 与 APP VerificationScreen 调用的 /api/verify-idcard 一致。
 * @returns {Promise<{ ok: boolean, message?: string, idNorm?: string }>}
 */
async function verifyNameIdCardWithTencent(name, idCard) {
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) {
    return null;
  }

  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs');
    const FaceidClient = tencentcloud.faceid.v20180301.Client;
    const region = process.env.TENCENT_FACEID_REGION || 'ap-shanghai';

    const client = new FaceidClient({
      credential: { secretId, secretKey },
      region,
      profile: {
        httpProfile: {
          endpoint: 'faceid.tencentcloudapi.com',
        },
      },
    });

    const resp = await client.IdCardVerification({
      IdCard: idCard,
      Name: name,
    });

    const code = resp.Result != null ? String(resp.Result) : '';
    const desc = resp.Description || '';

    if (code === '0') {
      return { ok: true };
    }

    const messages = {
      '-1': '姓名与身份证号不一致',
      '-2': '身份证号不合法',
      '-3': '姓名不合法',
      '-4': '证件库服务异常，请稍后重试',
      '-5': '证件库中无此身份证记录',
      '-6': '权威比对系统升级中，请稍后重试',
      '-7': '认证次数超过当日限制，请明日再试',
    };

    const msg = messages[code] || desc || '身份核验未通过';
    logger.warn('腾讯云二要素未通过', { code, desc: desc.slice(0, 80) });
    return { ok: false, message: msg };
  } catch (err) {
    logger.error('腾讯云二要素调用异常', { message: err.message });
    return {
      ok: false,
      message: '身份核验服务暂不可用，请稍后重试',
    };
  }
}

/**
 * 注册 / 登录 / verify-idcard 共用：先格式与校验位，再（若已配置）腾讯云二要素。
 */
async function verifyRealNameIdCard(realName, idCardRaw) {
  const name = (realName || '').trim();
  if (!name) {
    return { ok: false, message: '真实姓名不能为空' };
  }

  const idNorm = normalizeIdCard(idCardRaw);
  if (!idNorm) {
    return { ok: false, message: '身份证号不能为空' };
  }
  if (!isValidChineseIdCard(idNorm)) {
    return { ok: false, message: '身份证号格式或校验位不正确' };
  }

  if (process.env.VERIFY_IDCARD_BYPASS === '1') {
    logger.warn('VERIFY_IDCARD_BYPASS=1，已跳过腾讯云二要素（禁止用于生产）');
    return { ok: true, idNorm };
  }

  const tencent = await verifyNameIdCardWithTencent(name, idNorm);
  if (tencent === null) {
    logger.error('未配置 TENCENT_SECRET_ID/TENCENT_SECRET_KEY，无法进行联网身份核验');
    return {
      ok: false,
      message: '服务器未配置身份核验服务，请联系管理员',
    };
  }

  if (!tencent.ok) {
    return { ok: false, message: tencent.message };
  }

  return { ok: true, idNorm };
}

module.exports = {
  verifyRealNameIdCard,
  verifyNameIdCardWithTencent,
};
