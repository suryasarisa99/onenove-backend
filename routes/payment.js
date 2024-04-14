const router = require("express").Router();
const axios = require("axios");
// const phonepe = require();
const SHA256 = require("sha256");
const CryptoJS = require("crypto-js");

const { v4 } = require("uuid");
const { User } = require("../models/user");
// const HOST_URL = "https://api-preprod.phonepe.com/apis/hermes";
const HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const saltKey = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
const saltIndex = "1";
const merchantId = "PGTESTPAYUAT";
const merchantUserId = "MUID123";

router.post("/pay", async (req, res) => {
  const { _id } = req.body;
  const merchantTransactionId = v4();

  const user = await User.findById(_id);
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  user.transactions.push({
    amount: 5000,
    m_transaction_id: merchantTransactionId,
    transaction_type: "payment",
    transaction_id: merchantTransactionId,
    status: "initiated",
    onProduct: "1",
    is_debit: true,
  });

  await user.save();

  const payload = {
    merchantId: merchantId,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: merchantUserId,
    amount: 5000,
    // redirectUrl: `http://192.168.0.169:3000/payment/${merchantTransactionId}?userId=${_id}`, //backend url
    redirectUrl: `/https://books-b-sooty.vercel.app/payment/${merchantTransactionId}?userId=${_id}`, //backend url
    redirectMode: "REDIRECT",
    // callbackUrl: `http://192.168.0.169:3000/payment/${merchantTransactionId}?userId=${_id}`, //backend url
    mobileNumber: "9999999999",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const apiEndpoint = "/pg/v1/pay";
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const xVerify =
    SHA256(base64Payload + apiEndpoint + saltKey) + "###" + saltIndex;

  const options = {
    method: "POST",
    url: `${HOST_URL}${apiEndpoint}`,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
    },
    data: {
      request: base64Payload,
    },
    body: JSON.stringify(payload),
  };
  axios
    .request(options)
    .then((r) => {
      const url = r.data.data.instrumentResponse.redirectInfo.url;
      // res.redirect(url);
      res.json({ url: url });
    })
    .catch((err) => {
      console.log("error");
    });
});

router.get("/:merchantTransactionId", async (req, res) => {
  const merchantTransactionId = req.params.merchantTransactionId;
  console.log("============================================= ");
  console.log("============================================= ");
  console.log("<============= Verification =========> ");
  console.log("============================================= ");
  console.log("============================================= ");
  const userId = req.query.userId;
  // const merchantTransactionId = "MT7850590068188104";
  const apiEndpoint = `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`;

  const xVerify =
    SHA256(`/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey) +
    "###" +
    saltIndex;
  const options = {
    method: "get",
    url: apiEndpoint,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-MERCHANT-ID": merchantId,
      "X-VERIFY": xVerify,
    },
  };

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ error: "User not found" });
    const response = await axios.request(options);
    console.log(response.data);

    const product = { id: "1", price: 5000 };

    const promises = [];

    for (let transaction of user.transactions) {
      if (transaction.m_transaction_id === merchantTransactionId) {
        if (response.data.success) {
          transaction.status = "Success";
          // transaction.amount = response.data.data.amount;
          transaction.transaction_id = response.data.data.transactionId;
          user.products.push("1");

          // updating Parent's Rferal Bonus
          const parentUsers = await User.find({ _id: { $in: user.parents } });
          const parentUsersLength = parentUsers.length;
          const parentUsersSavePromise = parentUsers.map(
            async (parent, index) => {
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
            }
          );
          const admin = await User.findById("admin");
          const adminBalance =
            product.price - parentUsersLength * product.price * 0.2;
          admin.balance += adminBalance;
          if (parentUsersLength <= 3) {
            const childrenRef = admin.children[
              `level${parentUsersLength + 1}`
            ].find((child) => child._id === user._id);
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
          promises.push(...parentUsersSavePromise, admin.save(), user.save());
        } else {
          transaction.status = "Failed";
          transaction.transaction_id = response.data.data.transactionId;
          promises.push(user.save());
        }
        break;
      }
    }

    await Promise.all(promises);

    // res.send(response.data);
    // res.redirect("http://192.168.0.169:4444/payment-verification");
    res.redirect("https://one-novel.vercel.app/payment-verification");
  } catch (err) {
    console.log(err);
  }
});

module.exports = router;
