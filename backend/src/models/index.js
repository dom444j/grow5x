/**
 * Models Index
 * Centralized export of all Mongoose models
 */

const User = require('./User');
const Package = require('./Package');
const Wallet = require('./Wallet');
const Purchase = require('./Purchase');
const Transaction = require('./Transaction');
const Commission = require('./Commission');
const BenefitLedger = require('./BenefitLedger');
const SpecialCode = require('./SpecialCode');
const Withdrawal = require('./Withdrawal');

module.exports = {
  User,
  Package,
  Wallet,
  Purchase,
  Transaction,
  Commission,
  BenefitLedger,
  SpecialCode,
  Withdrawal
};