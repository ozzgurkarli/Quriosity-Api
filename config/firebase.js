const firebase = require("firebase/app");
require('dotenv').config();

const { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendEmailVerification, 
    sendPasswordResetEmail
  
  } = require("firebase/auth") ;

const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);

firebase.initializeApp(firebaseConfig);

module.exports = {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail
};