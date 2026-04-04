const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { verifyRealNameIdCard } = require('../utils/realNameVerify');

const router = express.Router();

/**
 * 身份证二要素核验（与 APP VerificationScreen 一致）
 * POST /api/verify-idcard  body: { name, idCard }
 */
router.post('/verify-idcard', authLimiter, async (req, res) => {
  try {
    const name = req.body?.name;
    const idCard = req.body?.idCard;
    const v = await verifyRealNameIdCard(name, idCard);
    if (!v.ok) {
      return res.status(400).json({
        success: false,
        message: v.message || '核验未通过',
      });
    }
    return res.json({ success: true, message: '核验通过' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router;
