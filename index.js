const express = require('express')
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const ShortId = require('mongoose-shortid-nodeps');
const randomstring = require('randomstring');
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client('179911329052-bt7801c9hu6gqh174qv0jl28clftchj1.apps.googleusercontent.com');

mongoose.connect(process.env.MONGO_URL);
let db = mongoose.connection;
db.once('open', () => {
    const storySchema = mongoose.Schema({
        _id: ShortId,
        author: String,
        title: String,
        prompt: String,
        private: Boolean,
        viewers:  {type: Number, default: 0},
        story: [
            {
                author: String,
                text: String
            }
        ],
        votes: {
            heart: {type: Number, default: 0},
            laugh: {type: Number, default: 0},
            'thumbs-up': {type: Number, default: 0},
            'thumbs-down': {type: Number, default: 0},
            love:  {type: Number, default: 0}
        }
    });

    const userSchema = mongoose.Schema({
        id: Number,
        name: String,
        email: String
    })

    const Story = mongoose.model('Story', storySchema);
    const User = mongoose.model('User', userSchema);
    
    app.use("/static", express.static(__dirname + '/src'))
    app.use(express.urlencoded())
    app.use(express.json())
    
    app.get('/', (req, res) => {
        res.render(__dirname + '/src/home.pug');
    })
    
    app.get('/stories', (req, res) => {
        res.render(__dirname + '/src/list.pug');
    })

    app.get('/story/:room/:mode', (req, res) => {
        Story.findById(req.params.room, (err, story) => {
            if(story) {
                res.render(__dirname + "/src/" + req.params.mode + ".pug", {
                    room: story._id,
                    story: story.story,
                    votes: story.votes,
                    title: story.title
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
    
    app.post('/login', (req, res) => {
        async function verify(token) {
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: '179911329052-bt7801c9hu6gqh174qv0jl28clftchj1.apps.googleusercontent.com',
            });
            const payload = ticket.getPayload();
            const userid = payload['sub'];
            let user = new User({
                id: payload['sub'],
                name: payload['name'],
                email: payload['email']
            })
            user.save((err, user) => {
                if(!err) {
                    res.json({id: user.id})
                }
            });
        }
        verify(req.body.id).catch(console.error);
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
                    socket.broadcast.to(room).emit("updateViewers", story.viewers);
                    story.save();
                }
            });
        });
    
        socket.on('disconnect', () => {
            Story.findById(socket.room, (err, story) => {
                if (story) {
                    story.viewers -= 1;
                    socket.broadcast.to(socket.room).emit("updateViewers", story.viewers);
                    story.save();
                }
            });
        });

        socket.on('input', ({input: input, author: author}) => {
            Story.findById(socket.room, (err, story) => {
                if(story.story.length > 0 && story.story[story.story.length - 1].author === author) {
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
            socket.broadcast.to(socket.room).emit("updateStory", words);
        });
        socket.on('vote', (vote) => {
            Story.findById(socket.room, (err, story) => {
                console.log(vote)
                if (story) {
                    story.votes[vote] += 1;
                    socket.broadcast.to(socket.room).emit("vote", {vote: vote, count: story.votes[vote]});
                }
                story.save();
            });
        });
    });
    
    http.listen(process.env.PORT || 80);
})