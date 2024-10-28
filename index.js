const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

const app = express();
app.use(bodyParser.json());

const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.post("/saveUser", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    await db.collection("users").add({
      username,
      email,
      password,
    });
    res.status(200).send("Kullanıcı başarıyla kaydedildi");
  } catch (error) {
    console.error("Hata:", error);
    res.status(500).send("Bir hata oluştu");
  }
});

// Kullanıcı adına göre verileri geri getiren GET endpoint
app.get("/getUserByUsername/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const userRef = db.collection("users");
    const snapshot = await userRef.where("username", "==", username).get();

    if (snapshot.empty) {
      res.status(404).send("Kullanıcı bulunamadı");
      return;
    }

    const users = [];
    snapshot.forEach(doc => {
      users.push(doc.data());
    });

    res.status(200).json(users);
  } catch (error) {
    console.error("Hata:", error);
    res.status(500).send("Bir hata oluştu");
  }
});

// Email'e göre verileri geri getiren GET endpoint
app.get("/getUserByEmail/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const userRef = db.collection("users");
    const snapshot = await userRef.where("email", "==", email).get();

    if (snapshot.empty) {
      res.status(404).send("Kullanıcı bulunamadı");
      return;
    }

    const users = [];
    snapshot.forEach(doc => {
      users.push(doc.data());
    });

    res.status(200).json(users);
  } catch (error) {
    console.error("Hata:", error);
    res.status(500).send("Bir hata oluştu");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});
