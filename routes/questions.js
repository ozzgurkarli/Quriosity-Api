const express = require("express");
const router = express.Router();
const {authenticateToken} = require("../services/auth");
const admin = require('../config/admin');
const db = admin.firestore();

router.get("/questions/:communityId/:lastOpenedDate", authenticateToken, async (req, res) => {
    const { communityId, lastOpenedDate } = req.params;
    const results = [];

    try {
        const snapshot = await db.collection("questions").where("CommunityId", "==", communityId).where("LastUpdateDate", ">", parseInt(lastOpenedDate)).orderBy("LastUpdateDate", "desc").limit(parseInt(lastOpenedDate) == 0 ? 0 : 10000).get();

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

router.put("/updateAnswers", authenticateToken, async (req, res) => {
    const { Username, uid, QuestionId, id, remove } = req.body;
    const now = new Date();
    let userFound = false;

    try {

        const snapshot = await db.collection("questions").doc(QuestionId).get();
        let list = snapshot.data().Answers;
        if (list) {
            if (remove) {
                list = list.filter(x => x.uid !== uid);
                userFound = true;
            }
            else {
                list.forEach(map => {
                    if (map.uid == uid) {
                        userFound = true;
                        map.id = id;
                    }
                });
            }

        }
        else {
            list = [];
        }

        if (!userFound) {
            list.push({
                id: id,
                Username: Username,
                uid: uid
            });
        }

        const docRef = db.collection("questions").doc(QuestionId);
        docRef.update({
            Answers: list,
            LastUpdateDate: now.getTime()
        });

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});

router.post("/newQuestion", authenticateToken, async (req, res) => {
    const { CommunityId, senderuid, Question, Options, InactiveUsers } = req.body;
    const now = new Date();

    try {
        const time = now.getTime();
        await db.collection("questions").doc().set({
            CommunityId: CommunityId,
            senderuid: senderuid,
            Question: Question,
            QuestionDate: time,
            LastUpdateDate: time,
            Options: Options
        });

        const snapshot = await db.collection("communities").doc(CommunityId).get();
        let streak = snapshot.data().Streak;
        let lastStreakUpdateDay = snapshot.data().LastStreakUpdateDay;
        const list = snapshot.data().Participants;
        list.forEach(map => {
            const inactiveUser = InactiveUsers.find(inactive => inactive.uid === map.uid);
            if (inactiveUser) {
                map.flag = 1;
                if (inactiveUser.NotificationToken !== undefined && inactiveUser.NotificationToken !== null) {
                    sendPushNotification(inactiveUser.NotificationToken, "Quriosity", snapshot.data().CommunityName + " topluluğunda bir yeni soru var!", "CMNTYHME", CommunityId);
                }
            }
        });
        if (streak == 0) {
            streak = 1;
        } else if (lastStreakUpdateDay != now.getDate()) {
            streak += 1;
        }

        const docRef = db.collection("communities").doc(CommunityId);
        docRef.update({
            Participants: list,
            Streak: streak,
            LastActivity: now.getTime(),
            LastStreakUpdateDay: now.getDate()
        });

        res.status(200).send("Success");
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu");
    }
});

module.exports = router;
