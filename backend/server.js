const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');


const app = express();
app.use(cors({
    origin: '*',  // Or specify your frontend URL here
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
}));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',  // Or specify your frontend URL here
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true,
    }
});

app.use(express.static(path.join(__dirname, '../frontend')));

io.on('connection', socket => {
    console.log('A user connected');

    socket.on('join', room => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
        socket.to(room).emit('new-user', socket.id);  // Send the sender's socket.id
        console.log(`New user`);
    });

    socket.on('offer', offer => socket.to('room1').emit('offer', offer, socket.id));
    socket.on('answer', answer => socket.to('room1').emit('answer', answer, socket.id));
    socket.on('candidate', candidate => {
        console.log('Server received ICE candidate:', candidate);
        socket.to('room1').emit('candidate', candidate, socket.id);
    });
    

    socket.on('chat', message => socket.to('room1').emit('chat', message));

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server listening on http://localhost:3000');
});
