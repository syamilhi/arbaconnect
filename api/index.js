/**
 * =============================================================================
 * ArbaConnect ERP - Vercel Serverless Function Entrypoint (api/index.js)
 * CV Arba'in Solo Raya
 * =============================================================================
 *
 * Mengalihkan seluruh trafik `/api/*` dan proteksi path sensitif di Vercel
 * ke HTTP handler utama pada `server/server.js`.
 */

'use strict';

const { server } = require('../server/server.js');

module.exports = (req, res) => {
  return new Promise((resolve) => {
    const done = () => resolve();
    if (res && typeof res.once === 'function') {
      res.once('finish', done);
      res.once('close', done);
    }
    server.emit('request', req, res);
    if (!res || typeof res.once !== 'function') {
      resolve();
    }
  });
};

