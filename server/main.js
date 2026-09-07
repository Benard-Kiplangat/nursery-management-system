const fs = require("fs");
const path = require("path");
const http = require("http");

const SERVER_PORT = Number(process.env.PORT) || 3000;
const app = require("./servers/kra-etims");

const server = http.createServer(app);
server.listen(SERVER_PORT, () => {
  console.log(`Server started on port ${SERVER_PORT}`);
});
