const router = require("express").Router();
const { User } = require("../models/user");
const jwt = require("jsonwebtoken");
const { v4 } = require("uuid");
const shortid = require("shortid");
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

router.post("/signup", async (req, res) => {
  try {
    const { name, number, email, password } = req.body;
    const { referal } = req.query;
    console.log(req.body);
    console.log(referal);

    if (!name || !number || !email || !password || !referal)
      return res.status(400).json({ error: "All fields are required" });

    const prvUser = await User.findOne({ number });
    // console.log(prvUser);
    if (prvUser) {
      console.log("user already found: ", prvUser);
      return res.status(400).json({ error: "User already exists" });
    }

    const users = await User.find();
    console.log(users);

    console.log("\n\nparent user");
    const parentUser = await User.findById(referal);
    console.log(parentUser);
    if (!parentUser) return res.status(400).json({ error: "Invalid referal" });

    const parentsTop3Referals = parentUser.parents
      .slice(0, 3)
      .filter((p) => p.id !== "admin");

    const user = new User({
      // _id: v4(),
      _id: shortid.generate(),
      name,
      number,
      email,
      password,
    });

    parentUser.directChild.push(user.id);

    if (parentUser.name !== "admin") {
      user.parents = [
        { name: parentUser.name, id: parentUser.id },
        ...parentsTop3Referals,
      ];
    }

    await parentUser.save();
    await user.save();

    console.log("User created: ", user);
    res.json({ mssg: "User created" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { number, password } = req.body;
  console.log(req.body);
  if (!number || !password)
    return res.status(400).json({ error: "All fields are required" });

  const user = await User.findOne({ number, password }, { password: 0 });
  console.log(user);
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { _id: user.id, email: user.email, number: user.number },
    process.env.JWT_SECRET
  );

  //   res.cookie("permanent", token, {
  //     httpOnly: true,
  //     secure: false,
  //     sameSite: "strict",
  //     maxAge: 1000 * 60 * 60 * 24 * 7,
  //   });

  res.json({
    message: "Logged in",
    token,
    user,
  });
});

router.get("/me", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("transactions.fromUser", "name email number")
    .populate("directChild", "name number email balance");

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(user);
});

module.exports = router;
