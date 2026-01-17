const path = require('path');
const express = require('express');

module.exports = function setupHttp(app) {
  const frontendPath = path.join(__dirname, '../../frontend');

  app.use(express.static(frontendPath));

  app.get('*', (_, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
};
