const BenefitLedger = require('../../models/BenefitLedger');
const Commissions = require('../../models/Commission');
const Withdrawals = require('../../models/Withdrawal');
const Licenses = require('../../models/License');
const mongoose = require('mongoose');

const to = v => Number.isFinite(+v) ? +v : 0;

module.exports = async function getUserSnapshot(userId) {
  // userId can be either custom userId (USR_xxx) or ObjectId depending on the caller
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? userId : new mongoose.Types.ObjectId(userId);
  
  const [benefPaid, commAvail, wAgg, activeLicenses, commissions, withdrawals] = await Promise.all([
    BenefitLedger.aggregate([
      { $match: { userId, status: 'paid' } },
      { $group: { _id: 0, total: { $sum: "$amountUSDT" } } }
    ]),
    Commissions.aggregate([
      { $match: { recipientUserId: userId, status: 'available' } },
      { $group: { _id: 0, total: { $sum: "$commissionAmount" } } }
    ]),
    Withdrawals.aggregate([
      { $match: { userId: userObjectId, status: { $in: ['PENDING','APPROVED','PAID','COMPLETED'] } } },
      { $group: { _id: 0,
        total: { $sum: { $toDouble: "$amount" } },
        pending: { $sum: { $cond: [{ $in: ["$status", ['PENDING','APPROVED']] }, { $toDouble: "$amount" }, 0] } }
      } }
    ]),
    Licenses.find({ userId, status: 'ACTIVE' }),
    Commissions.find({ recipientUserId: userId }).sort({ createdAt: -1 }),
    Withdrawals.find({ userId: userObjectId }).sort({ createdAt: -1 })
  ]);

  const paid  = to(benefPaid[0]?.total);
  const comm  = to(commAvail[0]?.total);
  const wTot  = to(wAgg[0]?.total);
  const wPend = to(wAgg[0]?.pending);
  const avail = Math.max(0, paid + comm - wTot);

  return {
    balances: {
      availableBalance: +avail.toFixed(2),
      pendingBalance:   +wPend.toFixed(2),
      totalEarned:      +(paid + comm).toFixed(2),
    },
    stats: { activeLicenses: activeLicenses.length },
    licenses: {
      active: activeLicenses.map(license => ({
        ...license.toObject(),
        principalUSDT: license.principalAmount
      }))
    },
    commissions,
    withdrawals
  };
};