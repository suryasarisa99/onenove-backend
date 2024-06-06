const router = require("express").Router();
const { User, ManualPayments, Withdrawl, Uploads } = require("../models/user");
const { authenticateAdminToken } = require("../utils/utils");
const jwt = require("jsonwebtoken");

// router.get("/reset", async (req, res) => {
//   await User.deleteMany();
//   await ManualPayments.deleteMany();
//   await Withdrawl.deleteMany();
//   const user = new User({
//     _id: "admin",
//     name: "admin",
//     number: "1234567890",
//     email: "amdin@gmail.com",
//     password: "",
//     verified: true,
//   });
//   await user.save();
//   res.json({ mssg: "reseted" });
// });

router.get("/delete/:userId", authenticateAdminToken, async (req, res) => {
  const { userId } = req.params;
  console.log(userId);
  if (!userId) return res.status(400).json({ error: "User Id is required" });
  const user = await User.findById(userId);
  user.transactions = [];
  user.balance = 5000;
  user.products = [];
  await user.save();
  res.json({ mssg: "deleted" });
});

router.get("/user/:type/:value", authenticateAdminToken, async (req, res) => {
  const { type, value } = req.params;
  const user = await User.findOne({ [type]: value });
  res.json(user);
});

router.post("/login", async (req, res) => {
  console.log(req.body);
  // admin login
  const { id, password } = req.body;
  if (!id || !password) return res.status(404).json({ error: "Invalid User" });

  const user = await User.findOne({
    _id: id,
    password,
  });

  if (!user)
    return res.status(404).json({
      error: {
        title: "Invalid Credentials",
        message:
          "The Entered Username or Password is Incorrect, Please Try Again",
      },
    });

  const token = jwt.sign(
    { _id: user.id, email: user.email, number: user.number },
    process.env.JWT_SECRET
  );

  const p = ManualPayments.find({ status: "pending" });
  const w = Withdrawl.find({ status: "pending" });
  const u = Uploads.find({ status: "pending" });
  const [payments, withdrawls, uploads] = await Promise.all([p, w, u]);
  res.json({ payments, withdrawls, uploads, payments, token });
});

router.post(
  "/confirm-withdrawl/:id",
  authenticateAdminToken,
  async (req, res) => {
    const { id } = req.params;
    const { message, status } = req.body;
    console.log(id, message, status);

    const withdrawl = await Withdrawl.findById(id);
    if (!withdrawl)
      return res.status(404).json({ error: "Withdrawl not found" });

    if (status === "rejected") {
      withdrawl.status = status;
      await User.updateOne(
        { _id: withdrawl.userId, "transactions._id": id },
        {
          $set: {
            "transactions.$.status": "rejected",
            "transactions.$.message": message,
          },
          $inc: {
            balance: withdrawl.amount,
          },
        }
      );
      await withdrawl.save();
      return res.json({ mssg: "Withdrawl Rejected" });
    } else if (status === "accepted") {
      withdrawl.status = status;
      await User.updateOne(
        { _id: withdrawl.userId, "transactions._id": id },
        {
          $set: {
            "transactions.$.status": "accepted",
            "transactions.$.message": message,
          },
        }
      );
      await withdrawl.save();
      return res.json({ mssg: "Withdrawl Accepted" });
    } else {
      return res.json({ mssg: "Invalid Status" });
    }
  }
);

router.get("/confirm-m-pay/:id", authenticateAdminToken, async (req, res) => {
  const { id } = req.params;
  const status = req.query.status;

  const payment = await ManualPayments.findById(id);

  if (status === "rejected") {
    payment.status = status;
    await payment.save();
    return res.json({ mssg: "Payment Rejected" });
  } else if (status === "accepted") {
    console.log("INside accept");
    payment.status = status;
    const user = await User.findById(payment.userId);
    user.products.push("1");

    const product = {
      id: "1",
      price: 5000,
    };
    // updating Parent's Rferal Bonus
    const parentUsers = await User.find({ _id: { $in: user.parents } });
    const parentUsersLength = parentUsers.length;
    const parentUsersSavePromise = parentUsers.map(async (parent, index) => {
      // updating Parent's Rferal Bonus
      console.log("Parent Index: ", index);
      let chilrenref = parent.children[`level${index + 1}`].find(
        (children) => children._id === user._id
      );
      if (chilrenref) chilrenref.valid = true;
      parent.balance += product.price * 0.2;
      parent.transactions.push({
        transaction_type: "Referal Bonus",
        amount: product.price * 0.2,
        referal_level: index + 1,
        onProduct: product.id,
        fromUser: user._id,
        is_debit: false,
      });
      return parent.save();
    });
    const admin = await User.findById("admin");
    const adminBalance =
      product.price - parentUsersLength * product.price * 0.2;
    admin.balance += adminBalance;
    if (parentUsersLength <= 3) {
      const childrenRef = admin.children[`level${parentUsersLength + 1}`].find(
        (child) => child._id === user._id
      );
      if (childrenRef) childrenRef.valid = true;
    }
    admin.transactions.push({
      transaction_type: "Referal Bonus",
      amount: adminBalance,
      onProduct: product.id,
      fromUser: user._id,
      referal_level: parentUsersLength + 1,
      is_debit: false,
    });
    const promises = [
      ...parentUsersSavePromise,
      admin.save(),
      user.save(),
      payment.save(),
    ];
    await Promise.all(promises);
    return res.json({ mssg: "Payment updated" });
  }
});

router.post(
  "/confirm-upload/:userId",
  authenticateAdminToken,
  async (req, res) => {
    const { userId } = req.params;
    const { id, status, amount } = req.body;
    console.log(req.body);
    if (!userId) return res.status(400).json({ error: "User Id is required" });
    if (!id || !status || amount === undefined)
      return res.status(400).json({ error: "Invalid Data" });

    try {
      const p1 = Uploads.updateOne({ _id: id }, { status });

      // update user uploads
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const lastUploadIndex = user.uploadedBooks.length - 1;
      user.uploadedBooks[lastUploadIndex].status = status;
      if (status == "accepted") {
        user.balance += amount;
        user.transactions.push({
          transaction_type: "Writers Benfit Bonus",
          amount,
          for: id,
          is_debit: false,
        });
      }

      const p2 = user.save();

      await Promise.all([p1, p2]);

      res.json({ mssg: "Updated", success: true });
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  }
);

router.get("/", authenticateAdminToken, async (req, res) => {
  const p = ManualPayments.find({ status: "pending" });
  const w = Withdrawl.find({ status: "pending" });
  const u = Uploads.find({ status: "pending" });
  const [payments, withdrawls, uploads] = await Promise.all([p, w, u]);
  res.json({ payments, withdrawls, uploads });
});

module.exports = router;
