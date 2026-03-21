const mongoose = require('mongoose');

const FEEDBACK_CATEGORIES = ['bug', 'suggestion', 'other'];
const FEEDBACK_PLATFORMS = ['web', 'ios', 'android'];

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: FEEDBACK_CATEGORIES,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    platform: {
      type: String,
      enum: FEEDBACK_PLATFORMS,
      required: true,
    },
    appVersion: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    clientInfo: {
      type: String,
      trim: true,
      maxlength: 256,
    },
    status: {
      type: String,
      enum: ['open', 'done'],
      default: 'open',
    },
    /** 附图 URL 路径，如 /uploads/feedback/xxx.jpg */
    images: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
module.exports.FEEDBACK_CATEGORIES = FEEDBACK_CATEGORIES;
module.exports.FEEDBACK_PLATFORMS = FEEDBACK_PLATFORMS;
