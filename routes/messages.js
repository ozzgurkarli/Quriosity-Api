const express = require("express");
const router = express.Router();
const {authenticateToken} = require("../services/auth");
const admin = require('../config/admin');
const db = admin.firestore();
const {generateNumber} = require('../services/helper');
const {generateToken} = require('../services/auth');

router.post("/sendMessage", authenticateToken, async (req, res) => {
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

router.get("/messages/:communityId/:lastOpenedDate", authenticateToken, async (req, res) => {
    const { communityId, lastOpenedDate } = req.params;
    const results = [];

    try {
        const snapshot = await db.collection("messages").where("CommunityId", "==", communityId).where("MessageDate", ">", parseInt(lastOpenedDate)).orderBy("MessageDate", "desc").limit(parseInt(lastOpenedDate) == 0 ? 0 : 10000).get();

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

module.exports = router;