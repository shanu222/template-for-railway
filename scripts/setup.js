#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const examplePath = path.join(root, ".env.example");
const envPath = path.join(root, ".env");

if (!fs.existsSync(examplePath)) {
  console.error(".env.example not found");
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log(".env already exists — leaving it unchanged.");
  process.exit(0);
}

let contents = fs.readFileSync(examplePath, "utf8");
const secret = crypto.randomBytes(48).toString("base64url");
contents = contents.replace(
  /JWT_SECRET=.*/,
  `JWT_SECRET=${secret}`,
);

fs.writeFileSync(envPath, contents, "utf8");
console.log("Created .env from .env.example with a generated JWT_SECRET.");
console.log("Start Postgres/Redis with: npm run docker:up");
console.log("Then run: npm run db:migrate:dev && npm run db:seed");
