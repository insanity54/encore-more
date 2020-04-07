
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const Ripper = require('./ripper');
const ripper = new Ripper();

app.get('/', function (req, res) {
  res.send('welcome');
})

app.get('/deck/:deckId', function (req, res) {
  const deckId = req.params.deckId;
  ripper.getDeckImage(deckId).then((deckImage) => {
    console.log('got deckImage??')
    // res.setHeader('Content-Type', 'image/jpeg');
    res.send(deckImage);
  })
  .catch((e) => {
    res.setHeader('Content-Type', 'text/plain');
    res.status(500, { error: e });
  })
});


const server = app.listen(port);
console.log(`app listening on port ${port}`)
