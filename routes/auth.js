const router = require("express").Router();
const { User, Numbers } = require("../models/user");
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
    const { name, number, email, password, referal } = req.body;
    console.log(req.body);

    if (!name || !number || !email || !password || !referal)
      return res.status(400).json({ error: "All fields are required" });
    const prvUser = await User.findOne({ number });
    if (prvUser) {
      console.log("user already found: ", prvUser);
      return res.status(400).json({ error: "User already exists" });
    }
    const parentUser = await User.findById(referal);
    if (!parentUser) return res.status(400).json({ error: "Invalid referal" });

    // Creating new User
    const otp = Math.floor(1000 + Math.random() * 9000);
    console.log("Opt Generated: ", otp);
    const user = new User({
      // _id: v4(),
      _id: shortid.generate(),
      name,
      number,
      email,
      password,
      otp: {
        code: otp,
        expireAt: Date.now() + 3 * 60 * 1000,
      },
    });

    // updating user parents
    const parentsTop3Referals = parentUser.parents
      .slice(0, 3)
      .filter((pId) => pId !== "admin");
    console.log("parentUser ", parentUser);
    if (parentUser.name !== "admin") {
      user.parents = [parentUser.id, ...parentsTop3Referals];
    }

    const parrentTop3users = await User.find({
      _id: { $in: parentsTop3Referals },
    });
    // updating children for parents level 1 and 2,3,4 and admin ( only if if level is less than 4 and not parent is admin)
    parentUser.children.level1.push({
      _id: user.id,
      valid: false,
    });
    const parentTop3Promises = parrentTop3users.map(async (parent, index) => {
      parent.children["level" + (index + 2)].push({
        _id: user.id,
        valid: false,
      });
      return parent.save();
    });
    if (parrentTop3users.length < 3 && parentUser.name !== "admin") {
      // here < 3 , means 1 for index, and another 1 for direct parent ( level 1 )
      // and parentUser.name !== "admin", means parent is not admink, because we already updated in admin as parent (level 1)
      const admin = await User.findById("admin");
      admin.children[`level${parrentTop3users.length + 2}`].push({
        _id: user.id,
        valid: false,
      });
      await admin.save();
    }

    // saving user and 4 parents
    const results = await Promise.allSettled([
      ...parentTop3Promises,
      parentUser.save(),
      user.save(),
    ]);

    // checking saved or not
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(`Error saving user ${i}: ${result.reason}`);
      }
    });
    console.log("User created: ", user);
    res.json({ mssg: "User created", id: user.id });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/otp", async (req, res) => {
  try {
    const { otp, id } = req.body;
    if (!id) return res.status(400).json({ error: "Number is required" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.verified)
      return res.status(400).json({ error: "User Already Verified" });
    if (user.otp.expireAt < Date.now()) {
      const otp = Math.floor(1000 + Math.random() * 9000);
      console.log("Opt Generated: ", otp);
      user.otp = {
        code: otp,
        expireAt: Date.now() + 3 * 60 * 1000,
      };
      await user.save();
      return res.status(400).json({ error: "OTP Expired", isLogedIn: false });
    }
    if (user.otp.code !== otp)
      return res.status(400).json({ error: "Invalid OTP", isLogedIn: false });

    user.otp = undefined;
    user.verified = true;

    const token = jwt.sign(
      { _id: user.id, email: user.email, number: user.number },
      process.env.JWT_SECRET
    );

    await user.save();
    res.json({
      message: "Credentials matched",
      isLogedIn: true,
      token,
      user,
      isAdmin: false,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { number, password } = req.body;
  if (!number || !password)
    return res.status(400).json({ error: "All fields are required" });

  const user = await User.findOne({ number });
  if (!user) {
    console.log("Invalid Phone Number: ", number);
    return res.status(400).json({ error: "User Not Exist" });
  }

  if (user.password !== password)
    return res.status(400).json({ error: "Invalid Password" });

  if (!user.verified)
    return res.status(400).json({
      error: "User not verified",
      isLogedIn: false,
      id: user._id,
    });

  const token = jwt.sign(
    { _id: user.id, email: user.email, number: user.number },
    process.env.JWT_SECRET
  );
  res.json({
    message: "Credentials matched",
    isLogedIn: true,
    token,
    user,
    isAdmin: user.name === "admin",
  });
});

function sendOtptoNumber(number, otp) {
  // implment this later

  return otp;
}

router.get("/me", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    isLogedIn: true,
    user: user,
    isAdmin: user.name === "admin",
  });
});

module.exports = router;
