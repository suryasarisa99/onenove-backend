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

router.get("/pay", async (req, res) => {
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
    redirectUrl: `http://192.168.0.169:3000/payment/${merchantTransactionId}`,
    redirectMode: "REDIRECT",
    callbackUrl: "https://webhook.site/callback-url",
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
    url: `${HOST_URL}${payEndPoint}`,
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
      res.redirect(url);
    })
    .catch((err) => {
      console.log("error");
    });
});

router.get("/:merchantTransactionId", async (req, res) => {
  const merchantTransactionId = req.params.merchantTransactionId;
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

  const user = await User.findById(userId);
  axios
    .request(options)
    .then(function (response) {
      console.log(response.data);
      res.send(response.data);
      user.transactions.forEach((transaction) => {
        if (transaction.m_transaction_id === merchantTransactionId) {
          transaction.status = response.data.status ? "Success" : "Failed";
          transaction.amount = response.data.data.amount;
          transaction.transaction_id = response.data.data.transactionId;
        }
      });
      user.products.push("1");
      user.save();
    })
    .catch(function (error) {
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
        console.log("error in verification");
      }
    });
});

module.exports = router;
