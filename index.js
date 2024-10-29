const express = require("express");
const bodyParser = require("body-parser");
const admin = require('./admin');
const firebase = require('./firebase');


const app = express();
app.use(bodyParser.json());


const db = admin.firestore();

app.post("/addUser", async (req, res) => {
    const { NameSurname, Username, Email, Password } = req.body;

    try {
        const user = await firebase.createUserWithEmailAndPassword(firebase.getAuth(), Email, Password)
            .then((userCredential) => {
                const user = userCredential.user;
                firebase.sendEmailVerification(firebase.getAuth().currentUser)
                    .then(() => {
                        db.collection("users").doc(Username).set({
                            NameSurname: NameSurname,
                            Email: Email,
                            uid: user.uid,
                        }).then(() => {
                            res.status(201).json({ message: "Verification email sent! User created successfully!" });
                        });
                    })
                    .catch((error) => {
                        console.error(error);
                        res.status(500).json({ error: "Error sending email verification" });
                    });
            })
            .catch((error) => {
                const errorMessage = error.message || "An error occurred while registering user";
                res.status(404).send("E-mail already in use.");
            });
    } catch (error) {
        console.error("Kullanıcı oluşturulurken hata:", error);
        res.status(500).send("Bir hata oluştu: " + error.message);
    }
});

app.post("/login", async (req, res) => {
    const { Username, Password } = req.body;

    try {
        const doc = await db.collection("users").doc(Username).get();

        if (!doc.exists) {
            return res.status(404).send("Username not found.");
        }

        const data = doc.data();

        const userCredential = await firebase.signInWithEmailAndPassword(firebase.getAuth(), data.Email, Password);
        const user = userCredential.user;

        if (user.uid == null) {
            return res.status(404).send("Password does not match.");
        }
        else if (!user.emailVerified) {
            return res.status(404).send("E-mail not verified.");
        }

        res.status(200).json(doc.data());
    } catch (error) {
        console.error("Kullanıcı oluşturulurken hata:", error);
        res.status(500).send("Bir hata oluştu: " + error.message);
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
