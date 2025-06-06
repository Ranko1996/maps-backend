require('dotenv').config()

const express = require('express')
const app = express()
const jwt = require('jsonwebtoken')

app.use(express.json())

let refreshTokens = []

const users = [
  { username: 'john', password: 'password123', role: 'user' },
  { username: 'jane', password: 'securepassword', role: 'user' },
  { username: 'admin', password: 'adminpass', role: 'admin' } 
];

app.post('/token', (req, res) => {
  const refreshToken = req.body.token
  if (refreshToken == null) return res.sendStatus(401)
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403)
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403)
    const accessToken = generateAccessToken({ name: user.name, role: user.role })
    res.json({ accessToken: accessToken })
  })
})

app.delete('/logout', (req, res) => {
  refreshTokens = refreshTokens.filter(token => token !== req.body.token)
  res.sendStatus(204)
})

app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).send('Invalid username or password');
  }

  const userForToken = { name: user.username, role: user.role };

  const accessToken = generateAccessToken(userForToken);
  const refreshToken = jwt.sign(userForToken, process.env.REFRESH_TOKEN_SECRET); 
  refreshTokens.push(refreshToken);
  res.json({ accessToken: accessToken, refreshToken: refreshToken });
})

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '240s' })
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403)
    req.user = user
    next()
  })
}

function authorizeAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next(); 
    } else {
        res.sendStatus(403); 
    }
}

app.get('/admin-dashboard', authenticateToken, authorizeAdmin, (req, res) => {
    res.send('Welcome to the Admin Dashboard, ' + req.user.name + '!');
});

app.listen(4000, () => {
  console.log('Server running on port 4000');
});