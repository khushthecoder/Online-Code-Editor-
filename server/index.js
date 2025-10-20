require('dotenv').config();
const express = require('express');
const authRoutes = require('./src/routes/authRoutes'); 

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello, server is running!');
});

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});