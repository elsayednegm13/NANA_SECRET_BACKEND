"use strict";

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
app.disable("x-powered-by");

// Never expose the project directory via express.static: it contains Node files.
const pages = fs.readdirSync(__dirname, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => entry.name);

for (const page of pages) {
  const routes = page === "index.html" ? ["/", "/index.html"] : ["/" + page];
  app.get(routes, (req, res) => res.sendFile(path.join(__dirname, page)));
}

app.use("/assets", express.static(path.join(__dirname, "assets"), {
  dotfiles: "deny",
  index: false,
  redirect: false
}));
app.use((req, res) => res.sendStatus(404));

if (require.main === module) {
  const port = Number(process.env.FRONTEND_PORT || 3000);
  app.listen(port, () => console.log("NANA SECRET frontend listening on http://localhost:" + port));
}

module.exports = app;
