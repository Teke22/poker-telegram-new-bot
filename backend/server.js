const { createServer } = require('http');
const express = require('express');
const cors = require('cors');

const setupHttp = require('./app/http');
const setupSocket = require('./app/socket');

const app = express();
app.use(cors());

setupHttp(app);

const server = createServer(app);
setupSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
