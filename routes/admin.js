const router = require("express").Router();
const { User, ManualPayments } = require("../models/user");
const { authenticateAdminToken } = require("../utils/utils");
const jwt = require("jsonwebtoken");
router.get("/reset", async (req, res) => {
  await User.deleteMany();
  const user = new User({
    _id: "admin",
    name: "admin",
    number: "1234567890",
    email: "amdin@gmail.com",
    password: "admin",
    verified: true,
  });
  await user.save();

  res.json({ mssg: "reseted" });
});
router.get("/test", async (req, res) => {
  // const users = await User.find({}).populate([
  //   { path: 'transactions.fromUser', select: 'name email' },
  //   { path: 'directChild', select: 'name number email balance' }
  // ]);
  try {
    const users = await User.find({})
      .populate("transactions.fromUser", "name email")
      .populate("directChild", "name number email balance");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

router.get("/delete/:userId", async (req, res) => {
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

router.get("/user/:id", async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id)
    .populate("transactions.fromUser", "name email")
    .populate("directChild", "name number email balance");
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

  const payments = await ManualPayments.find({ status: "pending" });
  res.json({ user, payments, token });
});

router.get("/confirm-m-pay/:id", authenticateAdminToken, async (req, res) => {
  const { id } = req.params;
  const status = req.query.status;

  const payment = await ManualPayments.findById(id);

  if (status === "reject") {
    payment.status = status;
    await payment.save();
    return res.json({ mssg: "Payment Rejected" });
  } else if (status === "accept") {
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

router.get("/", authenticateAdminToken, async (req, res) => {
  const user = await User.findById(req.user._id);
  const payments = await ManualPayments.find({ status: "pending" });
  res.json({ user, payments });
});

module.exports = router;
