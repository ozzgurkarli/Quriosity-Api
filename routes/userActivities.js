const express = require("express");
const router = express.Router();
const {authenticateToken} = require("../services/auth");
const admin = require('../config/admin');
const db = admin.firestore();

router.get("/userActivities/:CommunityId", authenticateToken, async (req, res) => {
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

router.post("/userActivities", authenticateToken, async (req, res) => {
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


module.exports = router;