const express = require("express");
const bodyParser = require("body-parser");
const admin = require('./admin');
const firebase = require('./firebase');
const expressWs = require("express-ws");


const app = express();
expressWs(app);
app.use(bodyParser.json());


var fcm = admin.messaging();
const db = admin.firestore();

const sendPushNotification = (deviceToken, title, body) => {
    const message = {
        token: deviceToken,
        notification: {
            title: title,
            body: body,
        },
        data: {
            xdxd: "hadi",
            lsls: "amk"
        },
    };

    fcm.send(message)
        .then((response) => {
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            console.log('Error sending message:', error);
        });
};

app.post("/addUser", async (req, res) => {
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

app.post("/login", async (req, res) => {
    const { Username, Password, uid, NotificationToken } = req.body;

    // sendPushNotification("key", "başlık", "body");

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

        return res.status(200).json({
            Username: doc.id,
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

app.get("/joinCommunity/:invitationCode/:uid", async (req, res) => {
    const { invitationCode, uid } = req.params;

    try {
        const snapshot = await db.collection("invitationCodes").where("InvitationCode", "==", invitationCode).get();

        if (snapshot.docs.length == 0) {
            return res.status(404).send("Community not found.");
        }

        const commId = snapshot.docs[0].id;

        const docRef = await db.collection("communities").doc(commId);
        const ssDoc = await docRef.get();
        const list = ssDoc.data().Participants;
        list.push({ uid: uid, flag: 0 });

        await docRef.update({
            Participants: list
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

app.post("/newQuestion", async (req, res) => {
    const { CommunityId, senderuid, Question, Options, InactiveUsers } = req.body;
    const now = new Date();

    try {
        await db.collection("questions").doc().set({
            CommunityId: CommunityId,
            senderuid: senderuid,
            Question: Question,
            QuestionDate: now.getTime(),
            Options: Options
        });

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});

app.get("/userActivities/:CommunityId", async (req, res) => {
    const { CommunityId } = req.params;
    const list = [];

    try {
        const snapshotAct = await db.collection("userActivities").where("CommunityId", "==", CommunityId).get();
        snapshotAct.forEach((doc) => {
            list.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return res.status(200).json(list);
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});

app.post("/userActivities", async (req, res) => {
    const { CommunityId, uid, State } = req.body;
    const list = [];

    try {
        if (State == 1) {
            await db.collection("userActivities").doc().set({
                uid: uid,
                CommunityId: CommunityId
            });

        } else {
            const snapshotAct = await db.collection("userActivities").where("uid", "==", uid).get();
            snapshotAct.forEach((doc) => {
                const docRef = db.collection("userActivities").doc(doc.id).delete();
            });
        }

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});


app.ws("/userActivities/:communityId", (ws, req) => {
    const { communityId } = req.params;
    let lastVisible = null;

    try {
        const messageRef = db.collection("userActivities").where("CommunityId", "==", communityId);

        const unsubscribe = messageRef.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === "removed") {
                    ws.send(JSON.stringify({
                        uid: change.doc.data().uid,
                    }));
                } else if (change.type === "added" || change.type === "modified") {
                    if (lastVisible && lastVisible.isEqual(change.doc)) {
                        return;
                    }
                    ws.send(JSON.stringify({
                        id: change.doc.id,
                        ...change.doc.data()
                    }));
                    lastVisible = change.doc;
                }
            });
        });

        ws.on("close", () => {
            unsubscribe();
        });

    } catch (error) {
        console.error("Error listening to community:", error);
        ws.send(JSON.stringify({ error: "An error occurred" }));
    }
});

app.ws("/questions/:communityId", (ws, req) => {
    const { communityId } = req.params;
    let lastVisible = null;

    try {
        const questionRef = db.collection("questions").where("CommunityId", "==", communityId).orderBy("QuestionDate", "desc").limit(1);

        const unsubscribe = questionRef.onSnapshot(snapshot => {
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


app.ws("/messages/:communityId", (ws, req) => {
    const { communityId } = req.params;
    let lastVisible = null;
    const now = new Date();

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
                        LastOpenedDate: now.getTime(),
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
        console.error(error);
    }
});


app.get("/communityUsernames/:communityId", async (req, res) => {
    const { communityId } = req.params;
    const results = [];

    try {
        const snapshotComm = await db.collection("communities").doc(communityId).get();

        const list = [];

        snapshotComm.data().Participants.forEach(map => {
            list.push(map.uid);
        });

        const snapshotUser = await db.collection("users").where("uid", "in", list).get();
        snapshotUser.forEach(doc => {
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


app.get("/questions/:communityId", async (req, res) => {
    const { communityId } = req.params;
    const results = [];

    try {
        const snapshot = await db.collection("questions").where("CommunityId", "==", communityId).orderBy("QuestionDate", "desc").limit(5).get();

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

app.get("/messages/:communityId/:lastOpenedDate", async (req, res) => {
    const { communityId, lastOpenedDate } = req.params;
    const results = [];

    try {
        const snapshot = await db.collection("messages").where("CommunityId", "==", communityId).where("MessageDate", ">", parseInt(lastOpenedDate)).orderBy("MessageDate", "desc").limit(50).get();

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

app.get("/invitationCode/:communityId", async (req, res) => {
    const { communityId } = req.params;
    const now = new Date();

    try {
        const snapshot = await db.collection("invitationCodes").doc(communityId).get();

        if (!snapshot.exists) {
            const invitationCode = generateInvitationCode();
            await db.collection("invitationCodes").doc(communityId).set({
                InvitationCode: invitationCode,
                GenerateDate: now.getTime()
            });
            return res.status(200).json({ InvitationCode: invitationCode });
        }

        return res.status(200).json(snapshot.data());
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

function generateInvitationCode() {
    const length = 12;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
