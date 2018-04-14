const express = require('express')
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mysql = require('mysql');
const randomstring = require('randomstring');

let rooms = {
    asfdafd: {
        viewers: 0,
        story: [
            {
                author: {
                    name: "Kirpal Demian",
                    color: "#55ffdd"
                },
                text: "Hi this is my story"
            },{
                author: {
                    name: "Kirpal Demian",
                    color: "#ff00dd"
                },
                text: "Paragraph 2"
            }],
        votes: {
            laughing: 0,
            hearts: 0,
            dead: 0,
            crying: 0
        }
    }
}

app.use("/static", express.static(__dirname + '/src'))
app.use(express.urlencoded())

app.get('/', (req, res) => {

})

app.get('/story/:room/write', (req, res) => {
    if(Object.keys(rooms).indexOf(req.params.room) !== -1) {
        res.render(__dirname + "/src/write.pug", {
            room: req.params.room,
            story: rooms[req.params.room].story,
            votes: rooms[req.params.room].votes
        });
    } else {
        res.redirect('/create');
    }
});

app.get('/story/:room/read', (req, res) => {
    if(Object.keys(rooms).indexOf(req.params.room) !== -1) {
        res.render(__dirname + "/src/read.pug", {room: req.params.room, story: rooms[req.params.room].story});
    } else {
        res.redirect('/create');
    }
});

app.get('/create', (req, res) => {
    res.render(__dirname + '/src/create.pug');
})

app.post('/create', (req, res) => {
    // store title, author, private/public, generate/store slug
})

io.on('connection', (socket) => {

    socket.on('room', (room) => {
        socket.room = room
        socket.join(room)
        rooms[room].viewers += 1;
        io.to(room).emit("updateViewers", rooms[room].viewers);
    });

    socket.on('disconnect', () => {
        rooms[socket.room].viewers -= 1;
        io.to(socket.room).emit("updateViewers", rooms[socket.room].viewers);
    });
    socket.on('input', (input) => {
        // store story text
    });
    socket.on('word', (words) => {
        io.to(socket.room).emit("updateStory", words);
    })
    socket.on('vote', (vote) => {
        rooms[socket.room].votes[vote] += 1;
        io.to(socket.room).emit("vote", {vote: vote, count: rooms[socket.room].votes[vote]});
    })
});

http.listen(process.env.PORT || 80);