// Vercel Serverless Function Handler
// This wraps the Express backend for deployment on Vercel Functions
// 
// When deployed to Vercel, all requests to /api/* will be handled by this function
// which loads and runs the Express app from backend/server.js

const app = require('../backend/server');

module.exports = app;
