const express = require("express");
const { ManualPayments, User } = require("../models/user");
const router = express.Router();
const { authenticateAdminToken, authenticateToken } = require("../utils/utils");

router.post("/pay", authenticateToken, async (req, res) => {
  const { utr } = req.body;
  const { _id } = req.user;

  if (!_id) return res.status(400).json({ error: "UnAuthorizatiod" });
  if (!utr) return res.status(400).json({ error: "UTR is Empty" });
  const user = await User.findById(_id);

  if (!user) return res.status(404).json({ error: "User not found" });

  const payment = ManualPayments({
    userId: _id,
    userName: user.name,
    number: user.number,
    utr: utr,
  });

  await payment.save();

  // const user = await User.findById(id);
  // user.transactions.push({
  //   transaction_type: "manual",
  //   amount: 5000,
  //   referal_level: 0,
  //   is_debit: false,
  // });

  return res.json({ mssg: "Payment Submitted" });
});

module.exports = router;
