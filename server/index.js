require('dotenv').config(); 
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000; 

app.use(express.json()); 
app.get('/', (req, res) => {
    res.send('Hello, server is running!');
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});