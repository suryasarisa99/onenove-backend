const router = require("express").Router();
const { User } = require("../models/user");

router.get("/reset", async (req, res) => {
  await User.deleteMany();
  const user = new User({
    _id: "admin",
    name: "admin",
    number: "00000",
    email: "amdin@gmail.com",
    password: "admin",
  });
  await user.save();
  //   {
  //     "_id": "ogMSEIl9A",
  //     "name": "surya",
  //     "number": "12345",
  //     "email": "surya",
  //     "password": "surya",
  //     "balance": 5000,
  //     "directChild": [],
  //     "products": [],
  //     "parents": [],
  //     "transactions": [],
  //     "__v": 0
  //     },
  //     {
  //     "_id": "gGmpTKehB",
  //     "name": "spider man",
  //     "number": "11111",
  //     "email": "spider",
  //     "password": "spider",
  //     "balance": 5000,
  //     "directChild": [],
  //     "products": [],
  //     "parents": [
  //     {
  //     "name": "surya",
  //     "id": "ogMSEIl9A",
  //     "_id": "6609063e2484941a8c5cd97f"
  //     }
  //     ],
  //     "transactions": [],
  //     "__v": 0
  //     }

  res.json({ mssg: "reseted" });
});
router.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

module.exports = router;
