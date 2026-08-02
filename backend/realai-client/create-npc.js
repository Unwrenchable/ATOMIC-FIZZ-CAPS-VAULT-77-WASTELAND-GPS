const axios = require('axios');

async function createNPC(name, description, style="fallout-meme") {
  const response = await axios.post('http://localhost:8000/api/create-character', {
    name,
    description,
    style,
    consistencyReference: "previous-good-avatar-id" // for face consistency
  });
  return response.data;
}

module.exports = { createNPC };
