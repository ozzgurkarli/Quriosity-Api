const admin = require('firebase-admin');
require('dotenv').config();
const pro = process.env;
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)),
});

module.exports = admin;
