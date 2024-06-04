const express = require("express");
const router = express.Router();
const { User, ManualPayments, Withdrawl } = require("../models/user");
const { authenticateAdminToken } = require("../utils/utils");

router.put("/transaction/:userId", authenticateAdminToken, async (req, res) => {
  const { userId } = req.params;
  const { amount, is_debit, status, type, tid, date } = req.body;
  console.log(req.body);
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const transactionItem = user.transactions.id(tid);
  transactionItem.status = status;
  transactionItem.transaction_type = type;
  transactionItem.amount = amount;
  transactionItem.is_debit = is_debit;
  transactionItem.date = date;
  await user.save();
});

router.post(
  "/transaction/:userId",
  authenticateAdminToken,
  async (req, res) => {
    const { userId } = req.params;
    const { amount, is_debit, status, type, tid, date } = req.body;
    console.log(req.body);
    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const transactionItem = user.transactions.create({
        status,
        transaction_type: type,
        amount,
        is_debit,
        date,
      });
      user.transactions.push(transactionItem);

      await user.save();

      return res.json({ mssg: "Transaction Added", id: transactionItem._id });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "An error occurred", err });
    }
  }
);

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
      date: t.date,
    }));
    await User.updateOne(
      { _id: userId },
      { $push: { transactions: { $each: mapedTransactions } } }
    );
    res.json({ mssg: "Transactions Added" });
  }
);

router.post("/referal/:userId", authenticateAdminToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { r, level } = req.body;
    const key = "children.level" + level;
    console.log(r, level);

    if (!userId) return res.status(400).json({ mssg: "UserId is Required" });

    try {
      const result = await User.updateOne(
        { _id: userId },
        {
          $push: {
            [key]: r,
          },
        }
      );
      if (result.nModified === 0)
        return res.status(404).json({ mssg: "User not found" });
    } catch {
      return res.status(404).json({ mssg: "User not found" });
    }

    return res.json({ mssg: "Referal Updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ mssg: "An error occurred", error });
  }
});

router.put("/referal/:userId", authenticateAdminToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { r, level } = req.body;
    const key = "children.level" + level;

    if (!userId) return res.status(400).json({ mssg: "UserId is Required" });

    const update = {
      $set: {
        [key + ".$"]: r,
      },
    };

    const filter = { _id: userId, [key + "._id"]: r._id };

    try {
      const result = await User.updateOne(filter, update);

      if (result.nModified === 0) {
        return res.status(404).json({ mssg: "User or Referal not found" });
      }

      return res.json({ mssg: "Referal Updated" });
    } catch (error) {
      return res.status(500).json({ mssg: "An error occurred", error });
    }
  } catch (error) {
    return res.status(500).json({ mssg: "An error occurred", error });
  }
});

// router.put("/referal/:userId", authenticateAdminToken, async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { r, level } = req.body;
//     const key = "level" + level;

//     if (!userId) return res.status(400).json({ mssg: "UserId is Required" });

//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({ mssg: "User not found" });
//     }

//     const index = user.children[key].findIndex((x) => x._id == r._id);

//     if (index === -1) {
//       return res.status(404).json({ mssg: "Referal not found" });
//     }

//     user.children[key].set(index, r);

//     await user.save();

//     return res.json({ mssg: "Referal Updated" });
//   } catch (error) {
//     return res.status(500).json({ mssg: "An error occurred", error });
//   }
// });

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
