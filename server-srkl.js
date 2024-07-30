const express = require('express');
const { createServer } = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const server = createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Allow all origins, you can restrict this to your Flutter app domain
        methods: ['GET', 'POST'],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});

// app.use(express.static('public'));

const PORT = 3000;
const BASE_URL = 'https://api.srkl.app/api/srkl';

let userSockets = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const handleGetAllChats = async (userId) => {
    const response = await axios.get(`${BASE_URL}/chat/getAllChats?userId=${userId}`);
    if (response?.data?.success) {
        return response?.data?.data;
    }
    else {
        console.log("Nothing Here");
        return [];
    }
}

io.on('connection', (socket) => {
    console.log('A user connected');

    const userId = socket.handshake.query.userId;

    if (userId !== undefined) {
        userSockets[userId] = socket.id;
    }

    socket.on('getAllChats', async ({ userId }) => {
        const userSocketId = userSockets[userId];
        const chats = await handleGetAllChats(userId);
        io.to(userSocketId).emit('getAllChats', {data: chats});
    });

    socket.on('private message', function (data) {
        const { recipientUserId, message } = data;
        const recipientSocketId = userSockets[recipientUserId];

        if (recipientSocketId) {
            io.to(recipientSocketId).emit('private message', { sender: socket.id, message });
            console.log(`Message sent from ${socket.id} to ${recipientUserId}`);
        } 
    });
      
    // Listen for chat messages
    socket.on('chat message', async (msg) => {
        console.log('message: ' + msg);

        // Emit the message to all clients
        io.emit('chat message', msg);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        delete userSockets[userId];
    });
});

server.listen(PORT, () => {
    console.log(`Server Running On Port: ${PORT}`);
});