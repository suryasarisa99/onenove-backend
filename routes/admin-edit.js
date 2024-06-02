const express = require("express");
const router = express.Router();
const { User, ManualPayments, Withdrawl } = require("../models/user");
const { authenticateAdminToken } = require("../utils/utils");

router.put("/transaction/:userId", authenticateAdminToken, async (req, res) => {
  const { userId } = req.params;
  const { amount, is_debit, status, type, tid } = req.body;
  console.log(req.body);
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const transactionItem = user.transactions.id(tid);
  transactionItem.status = status;
  transactionItem.transaction_type = type;
  transactionItem.amount = amount;
  transactionItem.is_debit = is_debit;
  await user.save();
});

router.post(
  "/transactions/:userId",
  authenticateAdminToken,
  async (req, res) => {
    const { userId } = req.params;
    const { transactions } = req.body;
    const mapedTransactions = transactions.map((t) => ({
      transaction_type: t.transaction_type,
      amount: t.amount,
      status: t.status,
      is_debit: t.is_debit,
    }));
    await User.updateOne(
      { _id: userId },
      { $push: { transactions: { $each: mapedTransactions } } }
    );
    res.json({ mssg: "Transactions Added" });
  }
);

router.put("/details/:userId", authenticateAdminToken, async (req, res) => {
  const { userId } = req.params;
  const { details } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.name = details.name;
  user.email = details.email;
  user.phone = details.phone;
  user.balance = details.balance;
  user.verified = details.verified;
  user.password = details.password;
  user.level = details.rank;
  user.products = details.pBought ? ["1"] : [];
  user.withdrawlType = details.wType;
  user.upi = details.upi;
  user.bank.bank_name = details.bankName;
  user.bank.account_no = details.accNo;
  user.bank.ifsc = details.ifsc;

  await user.save();
  res.json({ mssg: "Details Updated" });
});

module.exports = router;
