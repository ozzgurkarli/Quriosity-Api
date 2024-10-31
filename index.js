const express = require("express");
const bodyParser = require("body-parser");
const admin = require('./admin');
const firebase = require('./firebase');
const expressWs = require("express-ws");


const app = express();
expressWs(app);
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
        if (error.code == "auth/invalid-credential") {
            return res.status(404).send("Password does not match.");
        }
        console.error("Kullanıcı oluşturulurken hata:", error);
        res.status(500).send("Bir hata oluştu: " + error.message);
    }
});

app.post("/createCommunity", async (req, res) => {
    const { CommunityName, Participants } = req.body;
    const now = new Date();

    try {
        await db.collection("communities").doc().set({
            CommunityName: CommunityName,
            Participants: Participants,
            Streak: 0,
            LastActivity: now.getTime()
        });

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});


app.put("/communityOpened", async (req, res) => {
    const { id, uid } = req.body;
    const now = new Date();

    try {
        const snapshot = await db.collection("communities").doc(id).get();

        const list = snapshot.data().Participants;

        list.forEach(map => {
            if (map.uid === uid) {
                map.flag = 0;
            }
        });

        const docRef = db.collection("communities").doc(id);
        docRef.update({
            Participants: list
        });

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});


app.get("/communities/:uid", async (req, res) => {
    const { uid } = req.params;
    const results = [];

    try {
        const communitiesRef = await db.collection("communities");

        const querySnapshot1 = await communitiesRef
            .where("Participants", "array-contains", { uid: uid, flag: 1 })
            .get();
        const querySnapshot2 = await communitiesRef
            .where("Participants", "array-contains", { uid: uid, flag: 0 })
            .get();

        const results = [];

        const now = new Date();

        querySnapshot1.forEach(doc => {
            if ((now.getTime() - doc.data().LastActivity) > (36 * 60 * 60 * 1000) && doc.data().Streak > 0) {
                const docRef = db.collection("communities").doc(doc.id);
                docRef.update({
                    Streak: 0
                });
            }
            results.push({
                id: doc.id,
                ...doc.data()
            });
        });

        querySnapshot2.forEach(doc => {
            if ((now.getTime() - doc.data().LastActivity) > (36 * 60 * 60 * 1000) && doc.data().Streak > 0) {
                const docRef = db.collection("communities").doc(doc.id);
                docRef.update({
                    Streak: 0
                });
            }
            results.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return res.status(200).json(results);
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});

app.post("/sendMessage", async (req, res) => {
    const { CommunityId, senderuid, QuestionId, Message } = req.body;
    const now = new Date();

    try {
        await db.collection("messages").doc().set({
            CommunityId: CommunityId,
            senderuid: senderuid,
            QuestionId: QuestionId,
            MessageDate: now.getTime(),
            Message: Message
        });

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});


app.ws("/messages/:communityId", (ws, req) => {
    const { communityId } = req.params;
    let lastVisible = null;

    try {
        const messageRef = db.collection("messages").where("CommunityId", "==", communityId).orderBy("MessageDate", "desc").limit(1);

        const unsubscribe = messageRef.onSnapshot(snapshot => {
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    if (lastVisible && lastVisible.isEqual(doc)) {
                        return;
                    }
                    ws.send(JSON.stringify({
                        id: doc.id,
                        ...doc.data()
                    }));

                    lastVisible = doc;
                });
            }
        });

        ws.on("close", () => {
            unsubscribe();
        });

    } catch (error) {
        console.error("Error listening to community:", error);
        ws.send(JSON.stringify({ error: "An error occurred" }));
    }
});

app.get("/messages/:communityId", async (req, res) => {
    const { communityId } = req.params;
    const results = [];

    try {
        const snapshot = await db.collection("messages").where("CommunityId", "==", communityId).orderBy("MessageDate", "desc").limit(20).get();

        snapshot.forEach(doc => {
            results.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return res.status(200).json(results);
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});



app.get("/resetPassword/:username/:email", async (req, res) => {
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
