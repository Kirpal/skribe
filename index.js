const express = require('express')
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const ShortId = require('mongoose-shortid-nodeps');
const randomstring = require('randomstring');

mongoose.connect(process.env.MONGO_URL);
let db = mongoose.connection;
db.once('open', () => {
    const storySchema = mongoose.Schema({
        _id: ShortId,
        author: String,
        title: String,
        prompt: String,
        private: Boolean,
        viewers: Number,
        story: [
            {
                author: String,
                text: String
            }
        ],
        votes: {
            heart: Number,
            laugh: Number,
            'thumbs-up': Number,
            'thumbs-down': Number,
            love: Number
        }
    })

    const Story = mongoose.model('Story', storySchema);
    
    app.use("/static", express.static(__dirname + '/src'))
    app.use(express.urlencoded())
    
    app.get('/', (req, res) => {
    
    })
    
    app.get('/story/:room/:mode', (req, res) => {
        Story.findById(req.params.room, (err, story) => {
            if(story) {
                res.render(__dirname + "/src/" + req.params.mode + ".pug", {
                    room: story._id,
                    story: story.story,
                    votes: story.votes
                });
            } else {
                res.redirect('/create');
            }
        });
    });

    app.get('/story/:room', (req, res) => {
        res.redirect('/story/' + req.params.room + '/read')
    })
    
    app.get('/create', (req, res) => {
        res.render(__dirname + '/src/create.pug');
    })
    
    app.post('/create', (req, res) => {
        let story = new Story({
            author: req.body.author,
            title: req.body.title,
            prompt: req.body.prompt,
            private: req.body.private
        });

        story.save((err, story) => {
            if (!err) {
                res.redirect('/story/' + story._id + '/write')
            }
        });
    })
    
    io.on('connection', (socket) => {
    
        socket.on('room', (room) => {
            socket.room = room
            socket.join(room)
            Story.findById(room, (err, story) => {
                if (story) {
                    story.viewers += 1;
                    io.to(room).emit("updateViewers", story.viewers);
                }
            });
        });
    
        socket.on('disconnect', () => {
            Story.findById(socket.room, (err, story) => {
                if (story) {
                    story.viewers -= 1;
                    io.to(room).emit("updateViewers", story.viewers);
                }
            });
        });

        socket.on('input', ({input: input, author: author}) => {
            Story.findById(socket.room, (err, story) => {
                if(story.story[story.story.length - 1].author === author) {
                    story.story[story.story.length - 1].text = input
                } else {
                    story.story.push({
                        author: author,
                        text: input
                    });
                }

                story.save()
            })
        });

        socket.on('word', (words) => {
            io.to(socket.room).emit("updateStory", words);
        });
        socket.on('vote', (vote) => {
            Story.findById(socket.room, (err, story) => {
                if (story) {
                    story.votes[vote] += 1;
                    io.to(socket.room).emit("vote", {vote: vote, count: story.votes[vote]});
                }
            });
        });
    });
    
    http.listen(process.env.PORT || 80);
})