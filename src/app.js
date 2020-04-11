
const express = require('express');
const apicache = require('apicache');
const app = express();
const Fetcher = require('./fetcher');
const fetcher = new Fetcher();
const { testImagePaths } = require('../fixtures/fixtures');
const Image = require('./image');
const img = new Image();
const path = require('path');
const favicon = require('serve-favicon');
const redis = require('redis');
require('ssl-root-cas')
  .addFile(path.join(__dirname, 'www-encoredecks-com-chain.pem'));
const port = process.env.PORT || 5000;
let cache = apicache.middleware;
let redisUrl = process.env.REDIS_URL;
console.log(`redisUrl:${redisUrl}`);


const connectToRedisAndServe = () => {
  let cacheWithRedis = apicache.options({
    redisClient: redis.createClient(redisUrl) 
  }).middleware;

  app.engine('pug', require('pug').__express);
  app.use(favicon(path.join(__dirname, '..', 'data', 'favicon.ico')));
  // app.use(express.static('data'));
  // app.use(cache('1 day'));
  app.set('view engine', 'pug')
  app.set('views', path.join(__dirname, 'views'))

  app.get('/', function (req, res) {
    let d = req.headers.host;
    res.render('welcome', { domain: d });
  })

  app.get('/deck/:deckId', cache('1 day'), function (req, res) {
    const deckId = req.params.deckId;
    fetcher.getDeckImage(deckId).then((deckImage) => {
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


  // add route to display cache performance (courtesy of @killdash9)
  app.get('/api/cache/performance', (req, res) => {
    res.json(apicache.getPerformance())
  })
  
  // add route to display cache index
  app.get('/api/cache/index', (req, res) => {
    res.json(apicache.getIndex())
  })


  const server = app.listen(port);
  console.log(`app listening on port ${port}`)
} 

try {
  connectToRedisAndServe()
} catch (e) {
  setTimeout(connectToRedisAndServe, 5000);
}
