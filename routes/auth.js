const express = require("express");
const router = express.Router();
const { User, Numbers, Withdrawl, Uploads } = require("../models/user");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const { put } = require("@vercel/blob");
const multer = require("multer");
const upload = multer();
const path = require("path");
const { get } = require("http");
const { authenticateToken, transporter } = require("../utils/utils");

// const fast2sms = require("fast-two-sms");
// function sendOtp(number, name, otp) {
//   fast2sms.sendMessage({
//     authorization:
//       "xIqMWYhwPF7nSmdC4yb8LU0Oiuk9tJpaV2lAzegcj3GKZ1QNHf3wxqXbeTg2MJ8WmtVPYzanQjSICrHp",
//     message: `Hello ${name}, \n Your OTP For One Novel Verification is ${otp}`,
//     numbers: ["+91" + number],
//   });
// }

async function sendOtpToEmail(email, name, otp) {
  const mailOptions = {
    to: email,
    subject: "OTP Verification",
    html: `<h1>Hello ${name},</h1> <p>Your OTP For One Novel Verification is <b>${otp}</b></p>`,
    // text: `Hello ${name}, \n Your OTP For One Novel Verification is ${otp}`,
  };
  await transporter.sendMail(mailOptions);
}

function formatDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1; // Months are zero based
  const year = date.getFullYear().toString().substr(-2); // Get last two digits of year
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return `${day}/${month}/${year} - ${hours}:${minutes}`;
}

async function sendResetLink(email, name, link) {
  const mailOptions = {
    from: "1.one.novel.support@gmail.com",
    to: email,
    subject: `Resend Password on ${formatDate(new Date())}`,
    // html: `<h1>Hello ${name},</h1> <h1>Reset Your Forgotted Password  </h1> <a href=${link}>Click Here</a>`,
    html: `<!DOCTYPE html>
    <html>
      <head>
        <style>
          body{
            background-color: #f5f4f0;
            padding: 15px;
            font-family: sans-serif;
          }
          .button {
            background-color: #000000; /* Green */
            border: none;
            color: #ffffff;
            border-radius: 8px;
            padding: 15px 32px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            margin: 4px 2px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h2>Password Reset Request</h2>
        <h4>Hello, ${name}</h4>
        <p>
          We received a request to reset your password. If you didn't make this
          request, simply ignore this email. If you did, please click the button
          below to reset your password:
        </p>
        <a href="${link}" class="button">Reset Password</a>
        <p>Thanks,</p>
        <p>Your One Novel Team</p>
      </body>
    </html>`,
  };
  await transporter.sendMail(mailOptions);
}

router.post("/signup", async (req, res) => {
  try {
    const { name, number, email, password, referal } = req.body;
    console.log(req.body);

    if (!name || !number || !email || !password || !referal)
      return res.status(400).json({
        error: "All fields are required",
        mssg: "Please Enter All Fields",
      });
    const prvUser = await User.findOne({ number });
    if (prvUser) {
      console.log("user already found: ", prvUser);
      return res.status(400).json({
        error: "User already exists",
        mssg: "User Already Exists With that Phone Number, Please Login. Or Try with Another Number",
      });
    }
    const parentUser = await User.findById(referal);
    if (!parentUser) return res.status(400).json({ error: "Invalid referal" });

    // Creating new User
    const otp = Math.floor(1000 + Math.random() * 9000);
    await sendOtpToEmail(email, name, otp);
    const user = new User({
      // _id: v4(),
      _id: shortid.generate(),
      name,
      number,
      email,
      otp: {
        code: otp,
        expireAt: Date.now() + 15 * 60 * 1000,
      },
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

    try {
      await user.save();
    } catch {
      return res.status(400).json({
        error: "User Already Exists",
        mssg: "User Already Exists With that Email Address, Please Login. Or Try with Another Email Address",
      });
    }

    // saving user and 4 parents
    const results = await Promise.allSettled([
      ...parentTop3Promises,
      parentUser.save(),
    ]);

    // checking saved or not
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(`Error saving user ${i}: ${result.reason}`);
      }
    });

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
      // generate new otp
      const otp = Math.floor(1000 + Math.random() * 9000);
      console.log("Opt Generated: ", otp);
      user.otp = {
        code: otp,
        expireAt: Date.now() + 3 * 60 * 1000,
      };
      await user.save();
      return res.status(400).json({ error: "OTP Expired", isLogedIn: false });
    }
    // if (user.otp.code !== otp && otp != "0000")
    if (user.otp.code !== otp)
      return res.status(400).json({ error: "Invalid OTP", isLogedIn: false });

    user.otp = undefined;
    user.verified = true;

    await transporter.sendMail({
      to: process.env.ADMIN_EMAIL,
      subject: `New User Registered : ${user.id}`,
      html: `<h1>New User Registered</h1> <p>${user.name} is Registered with ${user.number}</p><p> ${user.email}</p><p> ${user.id}</p>`,
    });

    const token = jwt.sign(
      { _id: user.id, email: user.email, number: user.number },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
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
    return res.status(400).json({
      error: "All fields are required",
      mssg: "Please Enter All Fields, Try Again",
    });

  const user = await User.findOne({ number });
  if (!user) {
    console.log("Invalid Phone Number: ", number);
    return res.status(400).json({
      error: "User Not Exist",
      mssg: "No user found with this phone number. Please Signup to continue.",
    });
  }
  if (user.password !== password)
    return res.status(400).json({
      error: "Invalid Password",
      mssg: "The password you entered is incorrect. Please try again.",
    });

  if (!user.verified) {
    // write code to get current time in india ( +5:30 )
    const currentTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    // generate otp: when otp is undefined || otp is expired
    // use old otp: if otp has minimum 3 minutes left to expire
    console.log(user);
    if (!user.otp || user.otp.expireAt < currentTime) {
      const otp = Math.floor(1000 + Math.random() * 9000);
      console.log("Opt Generated: ", otp);
      user.otp = {
        code: otp,
        expireAt: Date.now() + 3 * 60 * 1000,
      };
      await sendOtpToEmail(user.email, user.name, otp);
      await user.save();
    } else if (currentTime - user.otp.expireAt < 3 * 60 * 1000) {
      await sendOtpToEmail(user.email, user.name, user.otp.code);
    }

    return res.status(400).json({
      error: "User not verified",
      mssg: `The phone number you entered is not verified. Please verify to continue. OTP Sent to Your ${user.email}`,
      isLogedIn: false,
      id: user._id,
    });
  }

  const token = jwt.sign(
    { _id: user.id, email: user.email, number: user.number },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
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
  if (amount < 1000)
    return res.status(400).json({
      error: "Minimum amount is 1000",
      mssg: "Please Enter Amount Greater than 100 And Try Again",
    });

  const user = await User.findById(userId);

  if (user.products.length == 0)
    return res.status(400).json({
      error: "Buy Product First",
      mssg: "Please Buy a Product to become member of OneNovel. Only Valid Members can Withdrawl",
    });

  if (user.balance < amount)
    return res.status(400).json({
      error: "Insufficient Balance",
      mssg: `You don't have enough balance, Your Balance is ${user.balance}`,
    });

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
    amount: amount,
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
    if (!upi)
      return res.status(400).json({
        error: "All fields are required",
        mssg: "Please Fill All Required Fields to Continue",
      });
    user.upi = upi;
    user.withdrawlType = type;
  }
  if (type == 2 || type == 3) {
    const { bank } = req.body;
    if (!bank.account_no || !bank.ifsc || !bank.bank_name)
      return res.status(400).json({
        error: "All fields are required",
        mssg: "Please Fill All Required Fields to Continue",
      });
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
    return res.status(400).json({
      error: "All fields are required",
      mssg: "Please Enter All Fields to Continue",
    });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { number } = decoded;
    const user = await User.findOne({ number });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.forgotMode)
      return res.status(400).json({
        error: "The Password Reset Link is Already Used",
        mssg: "Please Login with New Password or try  Forget Password Again",
      });
    user.password = password;
    user.forgotMode = false;
    await user.save();
    res.json({ mssg: "Password Updated" });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: "Password Reset Link Expired",
      mssg: "The Password Reset Link is Only Valid for 15 Minutes, Please Try Again",
    });
  }
});

router.get("/forgot-password/:number", async (req, res) => {
  const { number } = req.params;

  const user = await User.findOne({ number });
  if (!user)
    return res.status(404).json({
      error: "Invalid Details",
      mssg: "Please Enter Valid Phone Number",
    });

  const resetToken = jwt.sign({ number }, process.env.JWT_SECRET, {
    expiresIn: 60 * 15, // 15 minutes
  });

  // const resetLink = `http://192.168.0.169:4444/reset-password/${resetToken}`;
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  user.forgotMode = true;
  await sendResetLink(user.email, user.name, resetLink);
  await user.save();

  res.json({
    mssg: "Reset Link Sent",
    mail:
      user.email.substring(0, 3) +
      "*****" +
      user.email.substring(user.email.indexOf("@") - 1),
  });
});

router.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    const id = req.user._id;
    const filename = id + path.extname(req.file.originalname);
    const blob = await put(filename, req.file.buffer, {
      access: "public",
    });
    await User.updateOne(
      { _id: id, $expr: { $gt: [{ $size: "$products" }, 0] } },
      { $set: { uploadUrl: blob.url, uploadStatus: "pending" } }
    );
    console.log("Blob: ", blob.url);
    res.json({ mssg: "May Be Uploaded" });
  }
);

router.post("/upload-url", authenticateToken, async (req, res) => {
  const id = req.user._id;
  const { url } = req.body;
  try {
    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ error: "User not found", mssg: "Please Login Again" });

    if (
      user.uploadedBooks.length > 0 &&
      user.uploadedBooks[user.uploadedBooks.length - 1].status === "pending"
    )
      return res.status(400).json({
        error: "Wait Until Approval",
        mssg: "Previous Submission is Still Pending, Wait for its been Reviewed And then Upload Another",
      });

    const u = Uploads.create({
      url,
      userId: id,
      userName: user.name,
      status: "pending",
    });
    user.uploadedBooks.push({
      _id: u._id,
      url,
      status: "pending",
    });
    await user.save();

    res.json({ mssg: "Uploaded", success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user)
    return res
      .status(404)
      .json({ error: "User not found", mssg: "Please Login Again" });

  res.json({
    isLogedIn: true,
    user: user,
    isAdmin: user.name === "admin",
  });
});

router.get("/position", authenticateToken, async (req, res) => {
  const id = req.user._id;
  const user = await User.findById(id);
  console.log("/position ::");
  if (!user)
    return res
      .status(404)
      .json({ error: "User not found", mssg: "Please Login Again" });

  const levels = [5, 25, 125, 625];

  let newLevel = user.level;
  let increased = false;
  const newTransactions = [];

  for (let i = user.level; i < 4; i++) {
    if (
      user.children[`level${i + 1}`].filter((c) => c.valid).length >= levels[i]
    ) {
      // Do something
      newLevel = i + 1;
      user.balance += levels[i] * 500;
      const t = {
        transaction_type: "Gift",
        amount: levels[i] * 500,
        is_debit: false,
        for: i + 1,
      };
      newTransactions.push({ ...t, forLevel: i + 1 });
      user.transactions.push(t);
      increased = true;
    } else {
      break;
    }
  }

  if (increased) {
    user.level = newLevel;
    await user.save();
    console.log("Level Updated: ", user.level);
    return res.json({
      mssg: "Level Updated",
      user,
      increased,
      gifts: newTransactions,
    });
  } else {
    return res.json({ mssg: "Level Not Updated", increased });
  }

  // if (user.level == 0) {
  //   if (user.children.level1.length >= 5) {
  //   }
  //   if (user.children.level2.length >= 25) {
  //   }
  //   if (user.children.level3.length >= 125) {
  //   }
  //   if (user.children.level4.length >= 625) {
  //   }
  //   // save user
  // } else if (user.level == 1) {
  //   if (user.children.level2.length >= 25) {
  //   }
  //   if (user.children.level3.length >= 125) {
  //   }
  //   if (user.children.level4.length >= 625) {
  //   }
  //   // save user
  // } else if (user.level == 2) {
  //   if (user.children.level3.length >= 125) {
  //   }
  //   if (user.children.level4.length >= 625) {
  //   }
  //   // save user
  // } else if (user.level == 3) {
  //   if (user.children.level4.length >= 625) {
  //   }
  //   // save user
  // }
});

module.exports = router;
