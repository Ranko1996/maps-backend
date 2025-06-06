require('dotenv').config();

const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const pool = require('./db'); 
app.use(express.json());

let refreshTokens = [];

// VAŽNA NAPOMENA: Ovaj 'users' array je još uvijek hardkodiran.
// U produkcijskoj aplikaciji, korisnici bi se trebali spremati i provjeravati iz baze podataka
// (kao što smo radili u ranijim primjerima za registraciju i login s bazom).
const users = [
  { username: 'john', password: 'password123', role: 'user' },
  { username: 'jane', password: 'securepassword', role: 'user' },
  { username: 'admin', password: 'adminpass', role: 'admin' }
];

// --- JWT I AUTENTIFIKACIJSKE RUTE ---

app.post('/token', (req, res) => {
  const refreshToken = req.body.token;
  if (refreshToken == null) return res.sendStatus(401);
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    const accessToken = generateAccessToken({ name: user.name, role: user.role });
    res.json({ accessToken: accessToken });
  });
});

app.delete('/logout', (req, res) => {
  refreshTokens = refreshTokens.filter(token => token !== req.body.token);
  res.sendStatus(204);
});

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
});

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '240s' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    // console.log(err); // Dobro za debug, ukloni u produkciji
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function authorizeAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.sendStatus(403); // Forbidden
  }
}

app.get('/admin-dashboard', authenticateToken, authorizeAdmin, (req, res) => {
  res.send('Welcome to the Admin Dashboard, ' + req.user.name + '!');
});

// --- ATM RUTE (CRUD) ---

// GET Svi bankomati (zaštićeno tokenom)
app.get("/atms", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, type, address, coordinate_e AS "E", coordinate_n AS "N" FROM public.atm');

    const formattedAtms = result.rows.map(atm => ({
      id: atm.id,
      type: atm.type,
      address: atm.address,
      coordinates: {
        E: parseFloat(atm.E),
        N: parseFloat(atm.N)
      }
    }));

    res.json(formattedAtms);
  } catch (error) {
    console.error('Error fetching ATMs from database:', error);
    res.status(500).json({ message: 'Server error while fetching ATMs' });
  }
});

// POST Dodaj novi bankomat (zaštićeno: zahtijeva admin ulogu)
app.post("/atms", authenticateToken, authorizeAdmin, async (req, res) => {
  const { type, address, coordinate_e, coordinate_n } = req.body;

  // Osnovna validacija
  if (!type || !address || coordinate_e == null || coordinate_n == null) {
    return res.status(400).json({ message: 'All fields (type, address, coordinate_e, coordinate_n) are required.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO public.atm (type, address, coordinate_e, coordinate_n) VALUES ($1, $2, $3, $4) RETURNING id, type, address, coordinate_e AS "E", coordinate_n AS "N"',
      [type, address, coordinate_e, coordinate_n]
    );

    const newAtm = result.rows[0];
    const formattedNewAtm = {
        id: newAtm.id,
        type: newAtm.type,
        address: newAtm.address,
        coordinates: {
            E: parseFloat(newAtm.E),
            N: parseFloat(newAtm.N)
        }
    };
    res.status(201).json({ message: 'ATM added successfully', atm: formattedNewAtm });
  } catch (error) {
    console.error('Error adding ATM:', error);
    res.status(500).json({ message: 'Server error while adding ATM' });
  }
});

// PUT Ažuriraj postojeći bankomat (zaštićeno: zahtijeva admin ulogu)
app.put("/atms/:id", authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const { type, address, coordinate_e, coordinate_n } = req.body;

  // Provjeri je li barem jedno polje za ažuriranje poslano
  if (!type && !address && coordinate_e == null && coordinate_n == null) {
    return res.status(400).json({ message: 'At least one field (type, address, coordinate_e, coordinate_n) is required for update.' });
  }

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (type !== undefined) {
    updates.push(`type = $${paramIndex++}`);
    values.push(type);
  }
  if (address !== undefined) {
    updates.push(`address = $${paramIndex++}`);
    values.push(address);
  }
  if (coordinate_e !== undefined && coordinate_e !== null) { // Dopusti 0 kao validnu koordinatu
    updates.push(`coordinate_e = $${paramIndex++}`);
    values.push(coordinate_e);
  }
  if (coordinate_n !== undefined && coordinate_n !== null) { // Dopusti 0 kao validnu koordinatu
    updates.push(`coordinate_n = $${paramIndex++}`);
    values.push(coordinate_n);
  }

  if (updates.length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
  }

  values.push(id); // Dodaj ID na kraj niza vrijednosti

  try {
    const queryText = `
      UPDATE public.atm
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, type, address, coordinate_e AS "E", coordinate_n AS "N"`;

    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ATM not found.' });
    }

    const updatedAtm = result.rows[0];
    const formattedUpdatedAtm = {
        id: updatedAtm.id,
        type: updatedAtm.type,
        address: updatedAtm.address,
        coordinates: {
            E: parseFloat(updatedAtm.E),
            N: parseFloat(updatedAtm.N)
        }
    };
    res.json({ message: 'ATM updated successfully', atm: formattedUpdatedAtm });
  } catch (error) {
    console.error('Error updating ATM:', error);
    res.status(500).json({ message: 'Server error while updating ATM' });
  }
});

// DELETE Obriši bankomat (zaštićeno: zahtijeva admin ulogu)
app.delete("/atms/:id", authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM public.atm WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'ATM not found.' });
    }

    res.status(204).send(); // 204 No Content - uspješno obrisano, nema sadržaja za povrat
  } catch (error) {
    console.error('Error deleting ATM:', error);
    res.status(500).json({ message: 'Server error while deleting ATM' });
  }
});


app.listen(3000, () => {
  console.log('Server running on port 3000');
});