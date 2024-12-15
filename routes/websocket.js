const express = require("express");
const router = express.Router();
const admin = require('../config/admin');
const db = admin.firestore();

router.ws("/messages/:communityId", (ws, req) => {
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

router.ws("/userActivities/:communityId", (ws, req) => {
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

router.ws("/questions/:communityId", (ws, req) => {
    const { communityId } = req.params;
    let lastVisible = null;

    try {
        const questionRef = db.collection("questions").where("CommunityId", "==", communityId).orderBy("LastUpdateDate", "desc").limit(1);

        const unsubscribe = questionRef.onSnapshot(snapshot => {
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    if (lastVisible && lastVisible.isEqual(doc)) {
                        return;
                    }
                    const now = new Date();
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
        console.error("Error listening to community:", error);
        ws.send(JSON.stringify({ error: "An error occurred" }));
    }
});

module.exports = router;