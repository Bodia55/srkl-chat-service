const express = require('express');
const { createServer } = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

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

const handleGetChatsWith = async (chatId) => {
    const response = await axios.get(`${BASE_URL}/chat/getChatsWith/${chatId}`);
    if (response?.data) {
        return response?.data?.data;
    }
    else {
        return [];
    }
}

const addChatMessage = async (withId, userId, message) => {
    try {
        const response = await axios.post(`${BASE_URL}/chat/sendMessage/${withId}`, {
            userId: userId,
            message: message
        });

        console.log('API Response:', response.data);

        if (response?.data?.success) {
            return response?.data?.data;
        } else {
            console.error('Error adding chat message:', response.data);
            return [];
        }
    } catch (error) {
        console.error('Error in addChatMessage:', error);
        return [];
    }
}

app.post('/emitMedia', async (req, res) => {
    const { withId, userId, media } = req.body;

    console.log(withId);

    const userSocketId = userSockets[userId];
    const withSocketId = userSockets[withId];

    if (withSocketId) {
        console.log("HERE HERE");
        io.to(withSocketId).emit('privateMessage', { sender: userId, media: media });
    }
    
    return res.json({success: true});
});

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

    socket.on('getChatsWith', async ({ chatId, userId }) => {
        const userSocketId = userSockets[userId];
        const chatHistory = await handleGetChatsWith(chatId);
        io.to(userSocketId).emit('getChatsWith', {data: chatHistory});
    });

    socket.on('privateMessage', async function ({ withId, userId, message }) {
        const userSocketId = userSockets[userId];
        const withSocketId = userSockets[withId];

        if (withSocketId) {
            io.to(withSocketId).emit('privateMessage', { sender: userId, message: message });
        }

        await addChatMessage(withId, userId, message);
        
        console.log(`Message sent from ${socket.id} to ${withId}`);
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