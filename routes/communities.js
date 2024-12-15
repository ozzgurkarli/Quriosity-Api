const express = require("express");
const router = express.Router();
const {authenticateToken} = require("../services/auth");
const admin = require('../config/admin');
const {generateInvitationCode} = require('../services/helper');
const db = admin.firestore();

router.post("/createCommunity", authenticateToken, async (req, res) => {
    const { CommunityName, Participants } = req.body;
    const now = new Date();

    try {
        await db.collection("communities").doc().set({
            CommunityName: CommunityName,
            Participants: Participants,
            Streak: 0,
            LastStreakUpdateDay: 0,
            LastActivity: now.getTime()
        });

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});

router.get("/joinCommunity/:invitationCode/:uid", authenticateToken, async (req, res) => {
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


router.put("/communityOpened", authenticateToken, async (req, res) => {
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


router.get("/communities/:uid", authenticateToken, async (req, res) => {
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
                    Streak: 0,
                    LastStreakUpdateDay: 0
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
                    Streak: 0,
                    LastStreakUpdateDay: 0
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

router.get("/communityUsernames/:communityId", authenticateToken, async (req, res) => {
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

router.get("/invitationCode/:communityId", authenticateToken, async (req, res) => {
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


module.exports = router;