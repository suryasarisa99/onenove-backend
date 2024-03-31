const { connect } = require("mongoose");

const collection = "booksServer";
const DB_URL = `mongodb+srv://suryasarisa99:${process.env.DB_PASS}@cluster0.xtldukm.mongodb.net/${collection}?retryWrites=true&w=majority`;

const dbConnection = () => {
  return connect(DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => {
      console.log("Database connected");
    })
    .catch((err) => {
      console.log(err);
    });
};

module.exports = dbConnection;
