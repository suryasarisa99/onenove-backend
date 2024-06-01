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

module.exports = router;
