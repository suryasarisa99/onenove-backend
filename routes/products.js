const router = require("express").Router();
const jwt = require("jsonwebtoken");
const { User } = require("../models/user");
// const { authenticateToken } = require("../routes/auth");

const products = [{ id: "1", name: "Book 1", price: 5000 }];

function authenticateToken(req, res, next) {
  // let token = req.cookies.permanent;
  let token = req.headers.authorization;
  console.log(token);
  token = token.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Unauthorized", message: "No Token" });
  try {
    let user = jwt.verify(token, process.env.JWT_SECRET);
    if (user._id) {
      req.user = user;
      next();
    } else {
      console.log("User not found in token");
      res.status(401).json({ error: "Unauthorized" });
    }
  } catch (err) {
    console.log(err);
    console.log("invalid token");
    res.status(401).json({ error: "Unauthorized", message: "Invalid Token" });
  }
}

router.get("/", (req, res) => {
  res.json(products);
});

router.get("/buy/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  console.log("buy: ", id);
  console.log(req.user);
  const user = await User.findById(req.user._id);
  const product = products.find((product) => product.id == id);

  if (!user) return res.status(404).json({ error: "User not found" });
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (user.name === "admin")
    return res.status(400).json({ error: "Admin can't buy products" });
  if (user.balance < product.price)
    return res.status(400).json({ error: "Insufficient balence" });

  // User
  user.balance -= product.price;
  user.products.push(product.id);
  user.transactions.push({
    transaction_type: "product",
    onProduct: product.id,
    amount: product.price,
    is_debit: true,
  });

  // parents
  if (user.parents.length > 4)
    res.status(400).json({ error: "Error Having Parents More than 4" });
  const parentUsers = await User.find({ _id: { $in: user.parents } });
  const parentUsersSavePromise = parentUsers.map(async (parent, index) => {
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

  // admin
  const admin = await User.findById("admin");
  adminBalance = product.price - parentUsers.length * product.price * 0.2;
  admin.balance += adminBalance;
  admin.transactions.push({
    transaction_type: "Referal Bonus",
    amount: adminBalance,
    onProduct: product.id,
    fromUser: user._id,
    referal_level: parentUsers.length + 1,
    is_debit: false,
  });

  const results = await Promise.allSettled([
    ...parentUsersSavePromise,
    admin.save(),
    user.save(),
  ]);
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Error saving user ${i}: ${result.reason}`);
    }
  });
  res.json(product);
});

module.exports = router;
