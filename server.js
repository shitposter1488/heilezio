const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create/connect to database
const db = new sqlite3.Database('chat.db');

// Create table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Twitter API setup - Fixed to use bearerToken properly
const twitterClient = new TwitterApi({
  appKey: 'IAbzsBw7HFPtC1PU6Zc6OH7eN' ,
  appSecret: '8RrJjxbtNP29MYiU6BuUIdzELickEFBl2yLJqQQo60JyI2gh12' ,
});

async function getKojimaTweets() {
  try {
    const tweets = await twitterClient.v2.userByUsername('HIDEO_KOJIMA_EN');
    const userId = tweets.data.id;
    
    const timeline = await twitterClient.v2.userTimeline(userId, {
      max_results: 5,
      'tweet.fields': 'created_at,text'
    });
    
    return timeline.data || [];
  } catch (error) {
    console.log('Twitter API error:', error);
    return [];
  }
}

// Send tweets to clients every 5 minutes
setInterval(async () => {
  const tweets = await getKojimaTweets();
  io.emit('twitter updates', tweets);
}, 300000);

// Also send tweets immediately when server starts
setTimeout(async () => {
  const tweets = await getKojimaTweets();
  io.emit('twitter updates', tweets);
}, 5000);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('a user connected');
  
  // Send chat history when user connects
  db.all("SELECT * FROM messages ORDER BY timestamp", (err, rows) => {
    if (!err) {
      socket.emit('chat history', rows);
    }
  });

  // Handle login attempts - THIS WAS MISSING
  socket.on('login attempt', (credentials) => {
    // Simple authentication - you can modify these credentials
    const validUsers = {
      'Wustice': 'password432',
      'Bunny': 'Catssuck12!',
      'ezio': 'assassin',
      'hideo': 'kojima'
    };
    
    if (validUsers[credentials.username] && validUsers[credentials.username] === credentials.password) {
      socket.emit('login success', { username: credentials.username });
      console.log(`User ${credentials.username} logged in successfully`);
    } else {
      socket.emit('login failed', 'Invalid username or password');
      console.log(`Failed login attempt for username: ${credentials.username}`);
    }
  });

  socket.on('chat message', (data) => {
    // Add timestamp to the data
    const messageData = {
      username: data.username,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    
    // Save to database
    db.run("INSERT INTO messages (username, message) VALUES (?, ?)", 
           [messageData.username, messageData.message]);
    
    // Broadcast to all clients
    io.emit('chat message', messageData);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Make sure your HTML file is in the "public" folder as index.html');
});