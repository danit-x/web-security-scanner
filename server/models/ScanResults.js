const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true,
  },
  severity: {
    type: String,
    required: true,
    enum: {
      values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      message: '{VALUE} is not a valid severity level',
    },
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  recommendation: {
    type: String,
    required: true,
    trim: true,
  },
});

const scanResultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A scan result must be linked to a user'],
    },
    url: {
      type: String,
      required: [true, 'Please provide the scanned URL'],
      trim: true,
      lowercase: true,
    },
    grade: {
      type: String,
      required: [true, 'A report grade is required'],
      enum: {
        values: ['A', 'B', 'C', 'D', 'E', 'F'],
        message: '{VALUE} is not a valid grade',
      },
    },
    findings: [findingSchema],
  },
  {
    timestamps: true,
  }
);

scanResultSchema.virtual('scannedAt').get(function () {
  return this.createdAt;
});

scanResultSchema.set('toJSON', { virtuals: true });
scanResultSchema.set('toObject', { virtuals: true });

const ScanResult = mongoose.model('ScanResult', scanResultSchema);

module.exports = ScanResult;
