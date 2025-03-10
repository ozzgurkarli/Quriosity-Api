function generateNumber(length) {
    return Math.floor(Math.random() * length);
}

function generateInvitationCode() {
    const length = 12;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

module.exports = {generateNumber, generateInvitationCode};