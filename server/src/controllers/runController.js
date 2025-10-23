const axios = require('axios');
const language_ids = {
  'javascript': 93, 
  'python': 71,
  'cpp': 54, 
  'html': 0, 
  'css': 0,
  'java': 91
};

const runCode = async (req, res) => {
  const { language, code, stdin } = req.body;
  const languageId = language_ids[language];
  if (!languageId) {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  const options = {
    method: 'POST',
    url: `https://${process.env.RAPIDAPI_HOST}/submissions`,
    params: {
      base64_encoded: 'false',
      wait: 'true', 
    },
    headers: {
      'content-type': 'application/json',
      'Content-Type': 'application/json',
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    },
    data: {
      language_id: languageId,
      source_code: code,
      stdin: stdin || '', 
    },
  };

  try {
    const response = await axios.request(options);
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error running code' });
  }
};

module.exports = { runCode };