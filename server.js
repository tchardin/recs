const port = process.env.PORT || 3000
const express = require('express')
const request = require('request')
const cookieParser = require('cookie-parser')
const querystring = require('querystring')

// Uber API credentials
const CLIENT_ID = 'in7s2rG8izQ5j9xomHDqcu0eJ8bsmX28'
const CLIENT_SECRET = 'p5u1nb8ZozUzduYwmMe1AsAcE8jeUvPU-8YrfT05'
const REDIRECT_URI = 'http://localhost:3000/callback'

// twilio credentials
const accountSid = 'AC6051202fb4892d43605964acedee6eca'
const authToken = '93688e2ea558310287d5767317850c8d'

// State encoding
const generateRandomString = (length) => {
  var text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'uber_auth_state';

const server = express()

server.use(express.static('public'))
      .use(cookieParser())

server.get('/', (req, res) => {
  res.sendFile('index.html')
})

server.get('/activate', (req, res) => {
  res.sendFile('activate.html')
})

server.get('/login', (req, res) => {
  const state = generateRandomString(16)
  res.cookie(stateKey, state)

  const scope = 'profile history all_trips'
  res.redirect('https://login.uber.com/oauth/v2/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        state: state
      }))
})

server.get('/callback', (req, res) => {
  const code = req.query.code || null
  const state = req.query.state || null
  const storedState = req.cookies ? req.cookies[stateKey] : null

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }))
  } else {
    res.clearCookie(stateKey)
    const authOptions = {
      url: 'https://login.uber.com/oauth/v2/token',
      form: {
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
      },
      json: true
      }

      request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          var access_token = body.access_token,
              refresh_token = body.refresh_token

          res.redirect('/#' +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token
            }))
        } else {
          res.redirect('/#' +
            querystring.stringify({
              error: 'invalid_token'
            }))
        }
      })
    }
})

server.get('/refresh_token', (req, res) => {
  var refresh_token = req.query.refresh_token
  var authOptions = {
    url: 'https://login.uber.com/oauth/v2/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))},
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  }

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      let access_token = body.access_token
      res.send({
        'access_token': access_token
      })
    }
  })
})

// Twilio x Uber webhook
const client = require('twilio')(accountSid, authToken)

server.post('/webhook', (req, res) => {
  const data = req.body

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.meta.status === 'completed') {
          client.messages.create({
            to: "+16175103741",
            from: "+16178588826",
            body: "Would you like to offset your ride?"
          }, (err, message) => {
            console.log(message.sid)
          })
        }
      })
    })

  }

})

server.listen(port, () => {
  console.log(`Server listening to port ${port}`)
})
