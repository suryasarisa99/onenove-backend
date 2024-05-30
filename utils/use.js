const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const origins = [
  "http://192.168.0.169:4444",
  "https://one-novel.vercel.app",
  "https://one-novell.vercel.app",
  "https://one-novel-admin.vercel.app",
];

const corsOptions = {
  allowedHeaders: "Content-Type, Authorization",
  methods: "GET, POST, PUT, PATCH, DELETE",
  origin: origins,
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
