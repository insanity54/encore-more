
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const Ripper = require('./ripper');
const ripper = new Ripper();
const { testImagePaths } = require('../fixtures/fixtures');
const Image = require('./image');
const img = new Image();
const path = require('path');
var sslRootCAs = require('ssl-root-cas')
  .addFile(path.join(__dirname, 'www-encoredecks-com-chain.pem'));

app.engine('pug', require('pug').__express);
app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'views'))

app.get('/', function (req, res) {
  let d = req.headers.host;
  res.render('welcome', { domain: d });
})

app.get('/deck/:deckId', function (req, res) {
  const deckId = req.params.deckId;
  ripper.getDeckImage(deckId).then((deckImage) => {
    console.log('got deckImage!?')
    res.setHeader('Content-Type', 'image/jpg');
    deckImage.pipe(res);
  })
  .catch((e) => {
    res.setHeader('Content-Type', 'text/plain');
    res.status(500, { error: e });
  })
});


app.get('/test', function (req, res) {
  const testPath = path.join(__dirname, '..', 'data', 'test.jpg');
  try {
    let imageStream = img.createCardMosaic(testImagePaths)
    console.log('streaming image result')
    // console.log(imageStream);
    res.setHeader('Content-Type', 'image/jpg');
    imageStream.pipe(res);
  } catch (e) {
    console.error(e);
    res.send(e);
  }
})


const server = app.listen(port);
console.log(`app listening on port ${port}`)
