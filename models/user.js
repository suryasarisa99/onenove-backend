const { Schema, model } = require("mongoose");
const userSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  number: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  balance: {
    type: Number,
    default: 5000,
  },
  // referal_name: {},
  // referal_number: {},
  parents: {
    type: [
      {
        name: String,
        id: String,
      },
    ],
  },

  directChild: {
    type: [
      {
        type: String,
        ref: "User",
      },
    ],
  },
  products: {
    type: [String],
  },

  transactions: {
    type: [
      {
        transaction_type: String,
        onProduct: String,
        fromUser: { type: String, ref: "User" },
        amount: Number,
        referal_level: Number,
        date: {
          type: Date,
          default: Date.now,
        },
        is_debit: Boolean,
      },
    ],
  },
});

module.exports = {
  User: model("User", userSchema),
};
