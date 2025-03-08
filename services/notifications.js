const admin = require('../config/admin');
var fcm = admin.messaging();

const sendPushNotification = (deviceToken, title, body, screen, id) => {
    const message = {
        token: deviceToken,
        notification: {
            title: title,
            body: body,
        },
        data: {
            screen: screen,
            id: id
        },
    };

    fcm.send(message);
};

module.exports = { sendPushNotification };