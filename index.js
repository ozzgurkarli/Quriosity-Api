const express = require("express");
const bodyParser = require("body-parser");
const expressWs = require("express-ws");

const app = express();
expressWs(app);
app.use(bodyParser.json());

const userRoutes = require('./routes/users');
const communityRoutes = require('./routes/communities');
const messageRoutes = require('./routes/messages');
const websocketRoutes = require('./routes/websocket');
const questionRoutes = require('./routes/questions');
const userActivitiesRoutes = require('./routes/userActivities');


app.use(userRoutes);
app.use(communityRoutes);
app.use(messageRoutes);
app.use(websocketRoutes);
app.use(questionRoutes);
app.use(userActivitiesRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
