

require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs').promises;
const readline = require('readline');

const TOKEN_PATH = 'token.json';

async function authorize() {
  const credentials = {
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET,
    redirect_uris: ['urn:ietf:wg:oauth:2.0:oob']
  };

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0]
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar'],
  });

  console.log('\n------------------------------------------------------------------');
  console.log('Authorize this app by visiting this url:');
  console.log(authUrl);
  console.log('------------------------------------------------------------------\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oauth2Client.getToken(code);
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
      console.log('\n✅ Token stored successfully to', TOKEN_PATH);
      console.log('You can now start the main application with "npm start".');
    } catch (err) {
      console.error('\n❌ Error getting token', err.message);
    }
  });
}

authorize().catch(console.error);

