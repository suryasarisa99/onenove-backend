const router = require("express").Router();
const axios = require("axios");
// const phonepe = require();
const sha256 = require("sha256");
const CryptoJS = require("crypto-js");

const { v4 } = require("uuid");
// const HOST_URL = "https://api-preprod.phonepe.com/apis/hermes";
const HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const saltKey = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
const saltIndex = "1";
router.get("/pay", async (req, res) => {
  const payEndPoint = "/pg/v1/pay";
  console.log("in pay");

  const merchantTransactionId = v4();
  // const merchantTransactionId = "MT7850068188104";

  const payload = {
    merchantId: "PGTESTPAYUAT",
    merchantTransactionId: merchantTransactionId,
    merchantUserId: "MUID123",
    amount: 10000,
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
  const hash = CryptoJS.SHA256(
    base64Payload + apiEndpoint + saltKey
  ).toString();
  const xVerify = hash + "###" + saltIndex;

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
      console.log(r.data);
      const url = r.data.data.instrumentResponse.redirectInfo.url;
      res.redirect(url);
      // res.json({ url: r.data.data.instrumentResponse.redirectInfo.url });
    })
    .catch((err) => {
      //   console.log(err.response);
      console.log("error");
    });
});

router.get("/:merchantTransactionId", async (req, res) => {
  const merchantTransactionId = req.params.merchantTransactionId;
  const merchantId = "PGTESTPAYUAT";
  const apiEndpoint = `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`;

  const xVerify =
    CryptoJS.SHA256(apiEndpoint + saltKey).toString() + "###" + saltIndex;
  const options = {
    method: "get",
    url: apiEndpoint,
    headers: {
      accept: "application/json",
      // accept: "text/plain",
      "Content-Type": "application/json",
      "X-MERCHANT-ID": merchantId,
      "X-VERIFY": xVerify,
    },
  };
  axios
    .request(options)
    .then(function (response) {
      console.log(response.data);
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
