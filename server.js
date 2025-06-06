require('dotenv').config();

const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');

app.use(express.json());

const atms =  [
      {
        id: 1,
        type: 'Beskontaktni',
        address: 'Trg Bana Josipa Jelačića 1, Zagreb',
        coordinates: { E: 15.9770, N: 45.8131 }
      },
      {
        id: 2,
        type: 'Uplatno-isplatni',
        address: 'Ilica 10, Zagreb',
        coordinates: { E: 15.9754, N: 45.8136 }
      },
      {
        id: 3,
        type: 'Dnevno-noćni trezor',
        address: 'Vukovarska ulica 269F, Zagreb',
        coordinates: { E: 16.0076, N: 45.7958 }
      },
      {
        id: 4,
        type: 'Kovinomat',
        address: 'Maksimirska cesta 128, Zagreb',
        coordinates: { E: 16.0055, N: 45.8239 }
      },
      {
        id: 5,
        type: 'Beskontaktni',
        address: 'Avenija Dubrovnik 16 (Arena Centar), Zagreb',
        coordinates: { E: 15.9452, N: 45.7725 }
      },
      {
        id: 6,
        type: 'Uplatno-isplatni',
        address: 'Radićeva ul. 2, Zagreb',
        coordinates: { E: 15.9760, N: 45.8150 }
      },
      {
        id: 7,
        type: 'Beskontaktni',
        address: 'Gajeva ul. 5, Zagreb',
        coordinates: { E: 15.9775, N: 45.8115 }
      }
];

app.get("/atms", authenticateToken, (req, res) => {
    res.json(atms);
});



function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    console.log(err)
    if (err) return res.sendStatus(403)
    req.user = user
    next()
  })
}

app.listen(3000);