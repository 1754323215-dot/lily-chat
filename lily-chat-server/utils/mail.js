const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

function isSmtpConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendMail(opts) {
  const t = getTransporter();
  if (!t) {
    logger.debug('邮件未配置（缺少 SMTP_*），跳过发送');
    return false;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await t.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return true;
}

/**
 * 新反馈时通知管理员；可选给提交者发确认（需 FEEDBACK_CONFIRM_EMAIL=true 且用户资料有邮箱）
 */
async function notifyFeedbackSubmitted({ feedbackDoc, submitter }) {
  const adminRaw = process.env.FEEDBACK_NOTIFY_EMAIL || '';
  const adminEmails = adminRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const username = submitter?.username || '';
  const realName = submitter?.realName || '';
  const email = submitter?.email || '';

  if (adminEmails.length > 0 && isSmtpConfigured()) {
    const subject = `[Lily Chat] 新用户反馈 ${feedbackDoc._id}`;
    const text = [
      `类型: ${feedbackDoc.category}`,
      `平台: ${feedbackDoc.platform}`,
      `用户: ${username}（${realName}）`,
      `用户邮箱: ${email || '未填写'}`,
      `反馈内容:\n${feedbackDoc.content}`,
      `---`,
      `反馈ID: ${feedbackDoc._id}`,
    ].join('\n');
    for (const to of adminEmails) {
      try {
        await sendMail({ to, subject, text });
        logger.info('反馈通知邮件已发送', { to });
      } catch (e) {
        logger.warn('反馈通知邮件发送失败', { to, message: e.message });
      }
    }
  } else if (adminEmails.length > 0 && !isSmtpConfigured()) {
    logger.warn('已设置 FEEDBACK_NOTIFY_EMAIL 但未配置 SMTP_*，无法发邮件');
  }

  if (
    process.env.FEEDBACK_CONFIRM_EMAIL === 'true' &&
    email &&
    isSmtpConfigured()
  ) {
    try {
      await sendMail({
        to: email,
        subject: '[Lily Chat] 我们已收到您的反馈',
        text: [
          '您好，',
          '',
          `我们已收到您的反馈（编号 ${feedbackDoc._id}），感谢您的支持。`,
          '',
          `提交内容摘要：${feedbackDoc.content.slice(0, 300)}${
            feedbackDoc.content.length > 300 ? '…' : ''
          }`,
          '',
          '此邮件为系统自动发送，请勿直接回复。',
        ].join('\n'),
      });
      logger.info('反馈确认邮件已发给用户', { email });
    } catch (e) {
      logger.warn('反馈确认邮件发送失败', { email, message: e.message });
    }
  }
}

module.exports = {
  sendMail,
  notifyFeedbackSubmitted,
  isSmtpConfigured,
};
