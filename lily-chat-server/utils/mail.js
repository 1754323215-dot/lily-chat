const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const logger = require('./logger');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 将反馈附图以附件形式内嵌到邮件（cid），正文里用 <img src="cid:..."> 显示为图片
 */
function buildFeedbackInlineImages(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { attachments: [], htmlSnippet: '' };
  }
  const attachments = [];
  const htmlParts = [];
  imageUrls.forEach((urlPath, i) => {
    const fn = path.basename(urlPath || '');
    if (!fn || fn === '.' || fn === '..') return;
    const diskPath = path.join(__dirname, '..', 'uploads', 'feedback', fn);
    if (!fs.existsSync(diskPath)) {
      logger.warn('反馈附图文件不存在，无法内嵌邮件', { fn });
      return;
    }
    const cid = `feedbackimg${i}`;
    const ext = path.extname(diskPath) || '.png';
    attachments.push({
      filename: `feedback-${i}${ext}`,
      path: diskPath,
      cid,
    });
    htmlParts.push(
      `<p style="margin:8px 0;"><img src="cid:${cid}" alt="" style="max-width:560px;height:auto;border:1px solid #ddd;border-radius:6px;display:block;" /></p>`
    );
  });
  const htmlSnippet =
    htmlParts.length > 0
      ? `<div style="margin-top:16px;"><strong>附图：</strong>${htmlParts.join('')}</div>`
      : '';
  return { attachments, htmlSnippet };
}

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
 * @param {{ to: string, subject: string, text: string, html?: string, attachments?: object[] }} opts
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
    attachments: opts.attachments || [],
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
    const origin = (process.env.PUBLIC_API_ORIGIN || '').replace(/\/$/, '');
    const { attachments, htmlSnippet } = buildFeedbackInlineImages(
      feedbackDoc.images || []
    );
    const imgTextLines =
      feedbackDoc.images && feedbackDoc.images.length
        ? [
            '',
            '附图（纯文本客户端可打开下列链接）:',
            ...feedbackDoc.images.map((p) =>
              origin ? `${origin}${p}` : p
            ),
          ]
        : [];
    const text = [
      `类型: ${feedbackDoc.category}`,
      `平台: ${feedbackDoc.platform}`,
      `用户: ${username}（${realName}）`,
      `用户邮箱: ${email || '未填写'}`,
      `反馈内容:\n${feedbackDoc.content}`,
      ...imgTextLines,
      attachments.length
        ? '\n（支持 HTML 的邮箱中，附图已直接显示在邮件正文内。）'
        : '',
      `---`,
      `反馈ID: ${feedbackDoc._id}`,
    ].join('\n');

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;font-size:14px;color:#333;">
<p><strong>类型：</strong>${escapeHtml(feedbackDoc.category)}</p>
<p><strong>平台：</strong>${escapeHtml(feedbackDoc.platform)}</p>
<p><strong>用户：</strong>${escapeHtml(username)}（${escapeHtml(realName)}）</p>
<p><strong>用户邮箱：</strong>${escapeHtml(email || '未填写')}</p>
<p><strong>反馈内容：</strong></p>
<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(feedbackDoc.content)}</pre>
${htmlSnippet || ''}
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
<p style="color:#888;font-size:12px;">反馈ID：${escapeHtml(String(feedbackDoc._id))}</p>
</body></html>`;

    for (const to of adminEmails) {
      try {
        await sendMail({ to, subject, text, html, attachments });
        logger.info('反馈通知邮件已发送', { to, inlineImages: attachments.length });
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
