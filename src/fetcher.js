// Rip deck data from encoredecks website.

// Example deck page
// https://www.encoredecks.com/deck/ZT1ZXFQkp


const axios = require('axios');
const cheerio = require('cheerio');
const debug = require('debug')('encore-more');
const Promise = require('bluebird');
const imageUrlRegex = /\/images\/(.+)\/(.*)\/(.+\.gif)/; // 1 is language, 2 is release, 3 is imageName
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const Image = require('./image');
const img = new Image();

const cacheConfig = {
  enabledByDefault: true
}

// constants
const customHeaders = { 'User-Agent': `encore-more <chris@grimtech.net>` };
const rootUrl = 'https://www.encoredecks.com';
const httpAgent = axios.create({
  method: 'get',
  baseURL: rootUrl,
  headers: customHeaders
});


class Fetcher {

  /**
   *
   */
  constructor(options) {
    if (typeof options === 'undefined') options = {};
  }




  /**
   * buildImagePath
   *
   * Accepts an image URL as it's parameter and returns
   * a string of the perfect path on disk where the image should be saved.
   *
   * @example
   *   buildImagePath('https://www.encoredecks.com/images/JP/S22/033.gif')
   *   => "@/data/images/JP/S22/033.gif" (where @ is this project root.)
   *
   * @param {String} imageUrl - the URL to the image.
   * @returns {Promise}       - A promise that returns an array if resolved
   *                            or an error if rejected.
   * @resolve {String}        - An absolute path on disk.
   * @rejects {Error}         - An error which states the cause.
   */
  buildCardImagePath (imageUrl) {
    let regexResult = imageUrlRegex.exec(imageUrl);
    let language = regexResult[1];
    let sideRelease = regexResult[2];
    let imageName = regexResult[3];
    debug(`lang:${language}, sideRelease:${sideRelease}, name:${imageName}`);
    return path.join(__dirname, '..', 'data', 'images', language, sideRelease, imageName);
  }




  buildDeckUrl (deckId) {
    return `${rootUrl}/api/deck/${deckId}`
  }

  buildCardImageUrl (card) {
    return `${rootUrl}/images/${card.lang}/${card.side}${card.release}/${card.sid}.gif`
  }

  /**
   * ripDeckData
   *
   * - GET deck page. https://www.encoredecks.com/api/deck/<deckId>
   * - get list of cards.
   *
   *
   */
  ripDeckData (deckId) {
    let deckUrl = this.buildDeckUrl(deckId);
    debug(`ripping deck ${deckId} (${deckUrl})`)
    return httpAgent
    .request({ url: deckUrl, responseType: 'json' })
    .then((res) => {
      let data = res.data;
      let cardData = data.cards;
      let cardImages = cardData.map(this.buildCardImageUrl);
      debug(cardImages);
      return cardImages;
    })
  }


  downloadCardImage (cardImageUrl) {
    debug(`downloading ${cardImageUrl}`)
    let imagePath = this.buildCardImagePath(cardImageUrl);
    let requestPromise = httpAgent
      .request({ url: cardImageUrl, responseType: 'stream' })
    let folderPromise = fsp.mkdir(path.dirname(imagePath), { recursive: true })
    return new Promise.all([folderPromise, requestPromise]).then((res) => {
      return new Promise((resolve, reject) => {
        res[1].data.on('end', function() {
          let fromCache = (res[1].request.cache === true);
          debug(`download stream ended. fromCache?:${fromCache}`);
          resolve(imagePath);
        });
        res[1].data.on('error', function (e) {
          reject(e)
        })
        res[1].data.pipe(fs.createWriteStream(imagePath));
      })
    })
  }

  getDeckImage (deckId) {
    return this.ripDeckData(deckId).then((cardImages) => {
      console.log('got card images')

      return new Promise.map(cardImages, this.downloadCardImage.bind(this)).then((imagePaths) => {
        console.log(`downloading ${imagePaths.length} card images complete.`);
        return new Promise((resolve, reject) => {
          console.log('lets try');
          // setTimeout(() => {
            try {
              debug('lets try to get an image strim');
              let imageStream = img.createCardMosaic(imagePaths)
              resolve(imageStream);
            } catch (e) {
              reject(e);
            }
          // }, 5000);
        })
      })
    })
  }
}

module.exports = Fetcher;
