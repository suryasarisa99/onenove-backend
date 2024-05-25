const express = require("express");
const { ManualPayments } = require("../models/user");
const router = express.Router();
const { authenticateAdminToken, authenticateToken } = require("../utils/utils");

router.post("/pay", async (req, res) => {
  const { id, utr } = req.body;

  if (!id || !utr)
    return res.status(400).json({ error: "All fields are required" });

  const payment = ManualPayments({
    userId: id,
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
