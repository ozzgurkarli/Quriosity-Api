const express = require("express");
const router = express.Router();
const {authenticateToken} = require("../services/auth");
const admin = require('../config/admin');
const db = admin.firestore();
const {generateNumber} = require('../services/helper');
const {generateToken} = require('../services/auth');

router.post("/addUser", authenticateToken, async (req, res) => {
    const { NameSurname, Username, Email, Password, NotificationToken } = req.body;

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
                            ProfileIcon: generateNumber(4),
                            NotificationToken: NotificationToken
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

router.put("/updateProfileIcon", async (req, res) => {
    const { Username, ProfileIcon } = req.body;

    try {
        const docRef = await db.collection("users").doc(Username);
        await docRef.update({
            ProfileIcon: ProfileIcon
        });
    }
    catch (error) {
        console.error("Kullanıcı oluşturulurken hata:", error);
        res.status(500).send("Bir hata oluştu: " + error.message);
    }
});

router.post("/login", async (req, res) => {
    const { Username, Password, uid, NotificationToken } = req.body;

    try {
        const doc = await db.collection("users").doc(Username).get();

        if (!doc.exists) {
            return res.status(404).send("Username not found.");
        }

        const data = doc.data();

        if (uid == undefined) {
            const userCredential = await firebase.signInWithEmailAndPassword(firebase.getAuth(), data.Email, Password);
            const user = userCredential.user;

            if (user.uid == null) {
                return res.status(404).send("Password does not match.");
            }
            else if (!user.emailVerified) {
                return res.status(404).send("E-mail not verified.");
            }
        }

        if (NotificationToken != data.NotificationToken) {
            const docRef = await db.collection("users").doc(Username);

            await docRef.update({
                NotificationToken: NotificationToken
            });
        }

        const token = generateToken({ id: uid, username: Username, role: 'user' });
        return res.status(200).json({
            Username: doc.id,
            UserToken: token,
            ...doc.data()
        });
    } catch (error) {
        if (error.code == "auth/invalid-credential") {
            return res.status(404).send("Password does not match.");
        }
        console.error("Kullanıcı oluşturulurken hata:", error);
        res.status(500).send("Bir hata oluştu: " + error.message);
    }
});

router.get("/resetPassword/:username/:email", async (req, res) => {
    const { username, email } = req.params;

    try {
        const snapshot = await db.collection("users").doc(username).get();

        if (!snapshot.exists) {
            res.status(404).send("Username not found.");
            return;
        }
        const data = snapshot.data();

        if (email != data.Email) {
            res.status(404).send("Emails do not match.");
            return;
        }

        await firebase.sendPasswordResetEmail(firebase.getAuth(), data.Email);

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});

module.exports = router;