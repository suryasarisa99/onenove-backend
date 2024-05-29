const router = require("express").Router();
const { User, Numbers, Withdrawl } = require("../models/user");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const nodeMailer = require("nodemailer");

// const fast2sms = require("fast-two-sms");
// function sendOtp(number, name, otp) {
//   fast2sms.sendMessage({
//     authorization:
//       "xIqMWYhwPF7nSmdC4yb8LU0Oiuk9tJpaV2lAzegcj3GKZ1QNHf3wxqXbeTg2MJ8WmtVPYzanQjSICrHp",
//     message: `Hello ${name}, \n Your OTP For One Novel Verification is ${otp}`,
//     numbers: ["+91" + number],
//   });
// }

const transporter = nodeMailer.createTransport({
  service: "gmail",
  auth: {
    user: "gmlexamplez1@gmail.com",
    pass: "xlslbuuinptfswwu",
    // pass: "xlslbuuinptfswwu",
  },
});

function sendOtpToEmail(email, name, otp) {
  const mailOptions = {
    from: "gmlexamplez1@gmail.com",
    to: email,
    subject: "OTP Verification",
    html: `<h1>Hello ${name},</h1> <p>Your OTP For One Novel Verification is <b>${otp}</b></p>`,
    // text: `Hello ${name}, \n Your OTP For One Novel Verification is ${otp}`,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

function sendResetLink(email, name, link) {
  const mailOptions = {
    from: "gmlexamplez1@gmail.com",
    to: email,
    subject: "OTP Verification",
    html: `<h1>Hello ${name},</h1> <h1>Reset Your Forgotted Password  </h1> <a href=${link}>Click Here</a>`,
    // text: `Hello ${name}, \n Your OTP For One Novel Verification is ${otp}`,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}
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
    // const otp = Math.floor(1000 + Math.random() * 9000);
    // sendOtpToEmail(email, name, otp);
    const user = new User({
      // _id: v4(),
      _id: shortid.generate(),
      name,
      number,
      email,
      password,
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
      name: user.name,
      valid: false,
    });

    const parentTop3Promises = parrentTop3users.map(async (parent, index) => {
      parent.children["level" + (index + 2)].push({
        _id: user.id,
        name: user.name,
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
        name: user.name,
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

// router.post("/otp", async (req, res) => {
//   try {
//     const { otp, id } = req.body;
//     if (!id) return res.status(400).json({ error: "Number is required" });

//     const user = await User.findById(id);
//     if (!user) return res.status(404).json({ error: "User not found" });

//     if (user.verified)
//       return res.status(400).json({ error: "User Already Verified" });
//     if (user.otp.expireAt < Date.now()) {
//       const otp = Math.floor(1000 + Math.random() * 9000);
//       console.log("Opt Generated: ", otp);
//       user.otp = {
//         code: otp,
//         expireAt: Date.now() + 3 * 60 * 1000,
//       };
//       await user.save();
//       return res.status(400).json({ error: "OTP Expired", isLogedIn: false });
//     }
//     // if (user.otp.code !== otp && otp != "0000")
//     if (user.otp.code !== otp)
//       return res.status(400).json({ error: "Invalid OTP", isLogedIn: false });

//     user.otp = undefined;
//     user.verified = true;

//     const token = jwt.sign(
//       { _id: user.id, email: user.email, number: user.number },
//       process.env.JWT_SECRET
//     );

//     await user.save();
//     res.json({
//       message: "Credentials matched",
//       isLogedIn: true,
//       token,
//       user,
//       isAdmin: false,
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

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

  // if (!user.verified)
  //   return res.status(400).json({
  //     error: "User not verified",
  //     isLogedIn: false,
  //     id: user._id,
  //   });

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

router.post("/withdrawl", authenticateToken, async (req, res) => {
  const { amount, type } = req.body;
  const userId = req.user._id;

  if (!amount) return res.status(400).json({ error: "Amount is required" });
  if (amount < 100)
    return res.status(400).json({ error: "Minimum amount is 100" });

  const user = await User.findById(userId);

  if (user.balance < amount)
    return res.status(400).json({ error: "Insufficient Balance" });

  user.balance -= amount;

  const withdrawl = Withdrawl({
    userId,
    userName: user.name,
    amount,
    status: "pending",
    type,
    bank: user.bank,
    upi: user.upi,
  });

  user.transactions.push({
    id: withdrawl.id,
    transaction_type: "withdrawl",
    amount: -amount,
    type: "withdrawl",
    status: "pending",
    is_debit: true,
  });
  await user.save();
  await withdrawl.save();

  res.json({ mssg: "Withdrawl Requested" });
});

router.post("/withdrawl-details", authenticateToken, async (req, res) => {
  const { type } = req.body;
  const user = await User.findById(req.user._id);
  if (type == 1 || type == 3) {
    const { upi } = req.body;
    if (!upi) return res.status(400).json({ error: "All fields are required" });
    user.upi = upi;
    user.withdrawlType = type;
  }
  if (type == 2 || type == 3) {
    const { bank } = req.body;
    if (!bank.account_no || !bank.ifsc || !bank.bank_name)
      return res.status(400).json({ error: "All fields are required" });
    user.bank = {
      account_no: bank.account_no,
      ifsc: bank.ifsc,
      bank_name: bank.bank_name,
    };
    user.withdrawlType = type;
  }
  await user.save();

  return res.json({ mssg: "Details Updated", success: true });
});

router.post("/reset-password", async (req, res) => {
  const { password, token } = req.body;
  console.log("reset password: ");
  if (!password || !token)
    return res.status(400).json({ error: "All fields are required" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { number } = decoded;
    const user = await User.findOne({ number });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.forgotMode)
      return res.status(400).json({
        title: "Already Used This Link",
        error: "Please Login with New Password or use Forget Password Again",
      });
    user.password = password;
    user.forgotMode = false;
    await user.save();
    res.json({ mssg: "Password Updated" });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      title: "Password Reset Link Expired",
      error:
        "The Password Reset Link is Only Valid for 15 Minutes, Please Try Again",
    });
  }
});

router.get("/forgot-password/:number", async (req, res) => {
  const { number } = req.params;

  const user = await User.findOne({ number });
  if (!user) return res.status(404).json({ error: "User not found" });

  const resetToken = jwt.sign({ number }, process.env.JWT_SECRET, {
    expiresIn: 60 * 15, // 15 minutes
  });

  // const resetLink = `http://192.168.0.169:4444/reset-password/${resetToken}`;
  const resetLink = `https://one-novell.vercel.app/reset-password/${resetToken}`;
  user.forgotMode = true;
  sendResetLink(user.email, user.name, resetLink);
  await user.save();

  res.json({
    mssg: "Reset Link Sent",
    mail:
      user.email.substring(0, 3) +
      "*****" +
      user.email.substring(user.email.indexOf("@") - 1),
  });
});

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
