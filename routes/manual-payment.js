const express = require("express");
const { ManualPayments, User } = require("../models/user");
const router = express.Router();
const {
  authenticateAdminToken,
  authenticateToken,
  transporter,
} = require("../utils/utils");

router.post("/pay", authenticateToken, async (req, res) => {
  const { utr } = req.body;
  const _id = req.user._id;

  console.log(_id, utr);

  if (!_id)
    return res.status(400).json({
      error: "Unauthorizatiod",
      mssg: "Please Login to Continue",
    });
  if (!utr)
    return res.status(400).json({
      error: "UTR is Empty",
      mssg: "Please Enter UTR Number to Continue",
    });
  const user = await User.findById(_id);

  if (!user) return res.status(404).json({ error: "User not found" });

  await transporter.sendMail({
    to: "suryasarisa99@gmail.com",
    subject: `Manual Payment :${user._id}`,
    html: `<h1>Manual Payment</h1> <p>UserId: ${user._id}</p> <p>UserName: ${user.name}</p> <p>Amount: 5000</p> <p>Number: ${user.number}</p> <p>UTR: ${utr}</p>`,
  });

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
