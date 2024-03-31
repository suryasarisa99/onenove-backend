const express = require("express");
const app = express();
const session = require("express-session");
require("dotenv").config();

const use = require("./utils/use");
const dbConnection = require("./utils/db");

use(app);
dbConnection();

// * Routes
app.use("/auth", require("./routes/auth"));
app.use("/books", require("./routes/products"));
app.use("/admin", require("./routes/admin"));
app.get("/", (req, res) => {
  res.json({ server: "Books Server" });
});

app.listen(process.env.PORT || 3000);
