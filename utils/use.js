const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const origins = [];

const corsOptions = {
  allowedHeaders: "Content-Type, Authorization",
  methods: "GET, POST, PUT, PATCH, DELETE",
  origin: "*",
  //   origins: origins,
  //   credentials: true,
};

module.exports = function (app) {
  //   app.set("set engine", "pug");
  //   app.use(express.static("./public"));
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.options("*", cors());
};
