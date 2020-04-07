// Rip deck data from encoredecks website.

// Example deck page
// https://www.encoredecks.com/deck/ZT1ZXFQkp


const axios = require('axios');
const cheerio = require('cheerio');
const debug = require('debug')('encore-more');
const throttleRequests = require('./throttleRequests');
const Promise = require('bluebird');
const imageUrlRegex = /\/images\/(.+)\/(.*)\/(.+\.gif)/; // 1 is language, 2 is release, 3 is imageName
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const Image = require('./image');
const img = new Image();
var sslRootCAs = require('ssl-root-cas/latest')
  .addFile(path.join(__dirname, 'www-encoredecks-com-chain.pem'));


// constants
const customHeaders = { 'User-Agent': `encore-more`, 'Cache-Control': 'no-cache' };
const rootUrl = 'https://www.encoredecks.com';
const httpAgent = axios.create({
  method: 'get',
  baseURL: rootUrl,
  headers: customHeaders
});


class Ripper {

  /**
   *
   */
  constructor(options) {
    if (typeof options === 'undefined') options = {};
    this.url = options.url || undefined;
    this.throttle = options.throttle || 5;
    this.all = options.all || false;
    this.set = options.set || undefined;
    this.number = options.number || undefined;
    this.quiet = options.quiet || false;
    this.dataCounter = 0;
    this.imageCounter = 0;

    debug(`--- Ripper Class Construction ---`);
    debug(`url: ${this.url}`);
    debug(`deckId: ${this.deckId}`);
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
    console.log(`downloading ${cardImageUrl}`)
    let imagePath = this.buildCardImagePath(cardImageUrl);
    let requestPromise = httpAgent
      .request({ url: cardImageUrl, responseType: 'stream' })
    let folderPromise = fsp.mkdir(path.dirname(imagePath), { recursive: true })
    return new Promise.all([folderPromise, requestPromise]).then((res) => {
      return new Promise((resolve, reject) => {
        res[1].data.on('end', function() {
          console.log('download stream ended');
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

      return new Promise.map(cardImages, this.downloadCardImage.bind(this), { concurrency: 3 }).then((imagePaths) => {
        console.log(`downloading ${imagePaths.length} card images complete.`);
        return new Promise((resolve, reject) => {
          console.log('lets try');
          // setTimeout(() => {
            try {
              console.log('lets try to get an image strim');
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



  /**
   * buildCardDataPath
   *
   * Accepts a card URL as it's parameter and returns a string of the
   * perfect path on disk where the card data JSON should be saved.
   * The perfect path includes set abbreviation (ex: HMK,)
   * release number (ex: 01) and image name. (ex: HMK_01-001.json.)
   *
   * @example buildCardDataPath({"set": "HMK", "number": "01-001", ... })
   *          => "@/data/HMK/01/HMK_01-001.json" (where @ is project root)
   *
   * @param {String} cardUrl  - the URL to the card page on p-memories website.
   * @returns {Promise}       - A promise that returns a string if resolved
   *                            or an error if rejected.
   * @resolve {String}        - An absolute path on disk.
   * @rejects {Error}         - An error which states the cause.
   */
  buildCardDataPath (cardData) {
    let setAbbr = cardData.setAbbr;
    let number = cardData.number;
    let release = cardData.number.substr(0, cardData.number.indexOf('-'));
    return path.join(__dirname, '..', 'data', setAbbr, release, `${setAbbr}_${number}.json`);
  }

  /**
   * downloadImage
   *
   * Accepts a card image URL OR card URL as it's parameter and returns
   * a string of the path on disk where the image was saved.
   *
   * @param {String} targetUrl - the URL to the image or card page
   * @returns {Promise}       - A promise that returns an array if resolved
   *                            or an error if rejected.
   * @resolve {String}        - A string which tells where the image was saved.
   * @rejects {Error}         - An error which states the cause.
   */
  downloadImage (targetUrl) {
    if (typeof targetUrl === 'object') {
      // we might have got a card data object rather than a string URL
      if (targetUrl.image) return this.downloadImage(targetUrl.image);
      else throw new Error('targetUrl does not contain an image URL!');
    }
    else if (cardPageRegex.test(targetUrl)) {
      // targetUrl is a card page
      return this.ripCardData(targetUrl)
        .then((cardData) => {
          return this.downloadImage(cardData.image);
        });
    } else {
      // targetUrl is a card image
      return httpAgent
      .request({ url: targetUrl, responseType: 'stream' })
      .then((res) => {
        // ensure dir exists
        let imagePath = this.buildImagePath(targetUrl);
        debug(`writing image to ${imagePath}`);
        return fsp.mkdir(path.dirname(imagePath), { recursive: true }).then(() => {
          res.data.pipe(fs.createWriteStream(imagePath));
          return imagePath;
        })
      })
    }
  }

  normalizeUrl (url) {
    if (url.startsWith(rootUrl)) {
      return url;
    } else {
      return `${rootUrl}${url}`;
    }
  }


  /**
   * ripSetData
   *
   * Accepts a set URL as parameter and returns a list of card URLs
   * which belong in the set.
   *
   * @param {String} setUrl - the URL to the card set
   * @param {Array} dataAcc - object accumulator which contains a list of card
   *                          URLs and cardImageUrls.
   *                          Used for recursive calls of this function
   *                          during ripping of multi-page sets.
   * @returns {Promise}     - A promise that returns an Array if resolved
   *                          or an error if rejected
   * @resolve {Array} setData - An array of objects which contain cardUrl and cardImageUrl
   * @rejects {Error}       - An error which states the cause
   */
  ripSetData (setUrl, dataAcc) {
    debug(`ripping set data from ${setUrl}`);
    setUrl = this.normalizeUrl(setUrl);
    return httpAgent
      .request({ url: setUrl })
      .then((res) => {
        const $ = cheerio.load(res.data);
        if (typeof dataAcc === 'undefined') dataAcc = [];
        let cardA = $('td:nth-child(2) a');
        cardA.each((i, el) => {
          dataAcc.push({
            cardUrl: $(el).attr('href'),
            cardImageUrl: $(el).attr('src')
          })
        });
        // if there is a next page, get data from that page as well.
        let nextText = $('ul.pager > li:nth-last-child(2)').text();
        let nextPageUrl = $('ul.pager > li:nth-last-child(2) > a').attr('href');
        if (nextText === 'Next ›') {
          debug(`there is a next page. ripping ${nextPageUrl}`)
          return this.ripSetData(nextPageUrl, dataAcc);
        } else {
          debug('there are no further pages.')
          return dataAcc;
        }
      })
  }

  /**
   * isValidPMemoriesUrl
   *
   * Returns true or false depending on whether or not a valid P-memories.com
   * URL was passed as parameter.
   *
   * @param {String} url
   * @returns {Boolean} isValid - true if the url was p-memories.com url, false otherwise.
   */
   isValidPMemoriesUrl (input) {
     if (urlRegex.test(input) || relativeUrlRegex.test(input)) {
       return true;
     } else {
       return false;
     }
   }

  /**
   * ripCardData
   *
   * accepts a card URL as it's parameter and returns an object containing card
   * data and card image URL.
   *
   * @param {String} cardUrl - The URL to the card set
   * @param {String} cardImageUrl - The URL to the card image
   * @returns {Promise}      - A promise that returns an array if resolved
   *                           or an error if rejected
   * @resolve {Object}       - An object containing card data such as title,
   *                           description, rarity, type, AP, DP, image URL, etc.
   * @rejects {Error}        - An error which states the cause
   */
  ripCardData (cardUrl, cardImageUrl) {
    if (!this.isValidPMemoriesUrl(cardUrl)) {
      // we must have received a cardId
      return this.lookupCardUrl(cardUrl).then((card) => {
        return this.ripCardData(card.cardUrl, card.cardImageUrl);
      });
    } else if (this.incremental && typeof cardImageUrl !== 'undefined') {
      return this.isLocalCard(cardImageUrl).then((isLocal) => {
        if (isLocal) {
          console.log(`${cardImageUrl} is local.`);
          throw new Error('EEXIST');
        } else {
          console.log(`${cardImageUrl} is NOT local.`);
          return this.ripCardData(cardUrl, undefined);
        }
      })
    } else {
      return httpAgent
        .request({ url: this.normalizeUrl(cardUrl) })
        .then((res) => {
          const $ = cheerio.load(res.data);
          let data = {};

          /** Data gathered from the card data table on the webpage */
          data.number = $('.cardDetail > dl:nth-child(1) > dd:nth-child(2)').text();
          data.rarity = $('.cardDetail > dl:nth-child(2) > dd:nth-child(2)').text();
          data.setName = $('.cardDetail > dl:nth-child(3) > dd:nth-child(2)').text();
          data.name = $('.cardDetail > dl:nth-child(4) > dd:nth-child(2)').text();
          data.type = $('.cardDetail > dl:nth-child(5) > dd:nth-child(2)').text();
          data.usageCost = $('.cardDetail > dl:nth-child(6) > dd:nth-child(2)').text();
          data.outbreakCost = $('.cardDetail > dl:nth-child(7) > dd:nth-child(2)').text();
          data.color = $('.cardDetail > dl:nth-child(8) > dd:nth-child(2)').text();
          data.characteristic = $('.cardDetail > dl:nth-child(9) > dd:nth-child(2)').text();
          data.ap = $('.cardDetail > dl:nth-child(10) > dd:nth-child(2)').text();
          data.dp = $('.cardDetail > dl:nth-child(11) > dd:nth-child(2)').text();
          data.parallel = $('.cardDetail > dl:nth-child(12) > dd:nth-child(2)').text();
          data.text = $('.cardDetail > dl:nth-child(13) > dd:nth-child(2)').text();
          data.flavor = $('.cardDetail > dl:nth-child(14) > dd:nth-child(2)').text();

          /** Data that I think is good which isn't explicitly in the page */
          data.image = $('.Images_card > img:nth-child(1)').attr('src');
          data.image = `${rootUrl}${data.image}`;
          console.log(data.image);
          data.url = this.normalizeUrl(cardUrl);
          data.setAbbr = setAbbrRegex.exec(data.image)[1];
          let { num, release, id } = this.parseCardId(data.image);
          data.num = num;
          data.release = release;
          data.id = id;
          console.log(`ripping ${data.id}`);
          return data;
      })
    }
  }

  /**
   * lookupCardUrl
   *
   * Accepts a card ID as parameter, and resolves the appropriate cardUrl and
   * cardImageUrl belonging to that card.
   *
   * @param {String} cardId
   * @returns {Promise}       - A promise that returns an object if resolved
   *                            or an error if rejected
   * @resolve {Object} card
   * @resolve {String} card.cardUrl       - the url to the card page.
   *                                        Example: http://p-memories.com/node/926791
   * @resolve {String} card.cardImageUrl  - the image url of the card.
   *                                        Example: http://p-memories.com/images/product/SSSS/SSSS_01-001.jpg
   */
  lookupCardUrl (cardId) {
    let { setAbbr, number } = this.parseCardId(cardId);
    if (typeof setAbbr === 'undefined') throw new Error(`setAbbr could not be derived from ${cardId}`);
    return this.getSetUrlFromSetAbbr(setAbbr).then((setUrl) => {
      return this.getCardUrlsFromSetPage(number, setUrl);
    })
  }

  /**
   * getCardUrlsFromSetPage
   *
   * Accepts a cardNumber and setUrl as parameters, and returns
   * an object with cardUrl, and cardImageUrl.
   */
  getCardUrlsFromSetPage (cardNumber, setUrl) {
    return this.ripSetData(setUrl).then((cardList) => {
      let matchingCards = cardList.filter((c) => {
        let p = this.parseCardId(c.cardImageUrl);
        return (p.number === cardNumber)
      })
      return {
        cardUrl: this.normalizeUrl(matchingCards[0].cardUrl),
        cardImageUrl: this.normalizeUrl(matchingCards[0].cardImageUrl)
      }
    })
  }

  /**
   * writeCardData
   *
   * Accepts an object containing card data, and creates a JSON string
   * which is written to the appropriate location on disk.
   * To prevent the ripper from destroying local english translations,
   * writes merge JSON data files rather than blindly overwriting.
   *
   * @param {Object} cardData - the card data
   * @returns {Promise}       - A promise that returns an array if resolved
   *                            or an error if rejected
   * @resolve {String}        - The abs location on disk where the JSON was saved.
   * @rejects {Error}         - An error which states the cause
   */
  writeCardData (newCardData) {
    let cardDataPath = this.buildCardDataPath(newCardData);
    return fsp.mkdir(path.dirname(cardDataPath), { recursive: true }).then(() => {
      let existingData = {};
      try {
        existingData = require(cardDataPath);
      } catch (e) {
        debug(`${newCardData.number} has no existing data.`);
      }
      let mergedData = Object.assign({}, existingData, newCardData);
      return fsp.writeFile(
        cardDataPath, JSON.stringify(mergedData),
        { encoding: 'utf-8' }
      ).then(() => {
        return cardDataPath;
      })
    });
  }

  /**
   * readCardData
   *
   * reads the card data on disk
   *
   * @param {String} cardId - the card ID number.
   * @example
   *     readCardData('HMK_01-001');
   * @returns {Promise}       - A promise that returns an object if resolved
   *                            or an error if rejected
   * @resolve {Object}        - the card data read from disk
   * @rejects {Error}
   */
  readCardData (cardId) {
    return fsp.readFile(
      path.join(__dirname, '..', 'data', 'setAbbrIndex.json'),
      JSON.stringify(index)
    )
  }


  /**
   * getSetUrls
   *
   * accepts no parameters and returns a list of all set URLs found on p-memories
   * website.
   *
   * @returns {Promise}     - A promise that returns an array if resolved
   *                          or an error if rejected
   * @resolve {Array}       - An array containing set URLs
   * @rejects {Error}       - An error which states the cause
   */
  getSetUrls () {
    return httpAgent
      .request({ url: '/card_product_list_page' })
      .then((res) => {
        const $ = cheerio.load(res.data);
        let products = [];
        let ul = $('ul.productlist a');
        ul.each(function (i, el) {
          products.push($(this).attr('href'));
        });
        return products;
      })
      .catch(e => {
        console.error(e);
      })
  }


  /**
   * ripCardDataAndSave
   */
   ripCardDataAndSave (cardUrl, cardImageUrl) {
     return this.ripCardData(cardUrl, cardImageUrl).then((cardData) => {
       return this.saveCardData(cardData).then((writeResult) => {
         if (writeResult[0]) this.dataCounter++;
         if (writeResult[1]) this.imageCounter++;
       })
     }).catch((e) => {
       console.log(`${cardImageUrl} already exists locally. skipping.`)
     })
   }

  /**
   * ripAll
   *
   * accepts no parameters and downloads all card data and card images
   * found p-memories.com.
   *
   * @returns {Promise}     - A promise that returns a number if resolved
   *                          or an error if rejected
   * @resolve {Number}      - The number of card data ripped from p-memories
   * @rejects {Error}       - An error which states the cause
   */
  ripAll () {
    // getSetUrls => setUrls
    // for each setUrl, ripSetData. => cardUrls
    // for each cardUrl, ripCardData. => cardData
    // for each cardData, writeCardData => jsonFilePath
    // for each cardData, downloadImage => imagePath
    console.log('ripping all sets');
    return this.getSetUrls().then((setUrls) => {
      return Promise.mapSeries(setUrls, (setUrl) => {
        debug(`ripping set data ${setUrl}`);
        return this.ripSetData(setUrl).then((cards) => {
          return Promise.mapSeries(cards, (card) => {
          debug(`ripping card data ${card.cardUrl}`);
            return this.ripCardDataAndSave(card.cardUrl, card.cardImageUrl)
          })
        })
      })
    }).catch((e) => {
      console.error(e);
      console.error('there was an error.');
    }).then(() => {
      console.log(`done. card data: ${this.dataCounter}. images: ${this.imageCounter}`);
      return (this.dataCounter);
    })
  }


  /**
   * ripUrl
   *
   * Rip a resource. Used by the CLI.
   * url could be one of several resources.
   *
   *   * Card URL  (defers to ripCardData)
   *   * Set URL   (defers to ripSetData)
   *   * undefined (defers to ripAll)
   *
   * @param {String} url       - The URL to rip
   * @returns {Promise}        - A promise that returns a number if resolved
   *                             or an error if rejected
   * @resolve {Number}         - The number of card data ripped
   * @rejects {Error}          - An error which states the cause
   */
  ripUrl (url) {
    let urlType = this.identifyUrl(url);
    if (urlType === 'card') {
      return this.ripCardData(url);
    } else if (urlType === 'set') {
      return this.ripSetData(url).then((cards) => {
        return Promise.mapSeries(cards, (card) => {
          console.log(`ripping card data ${card.cardUrl} and image ${card.cardImageUrl}`);
          return this.ripCardDataAndSave(card.cardUrl, card.cardImageUrl);
        });
      });
    } else {
      return ripAll();
    }
  }


  /**
   * saveCardData
   *
   * Download the card data and image file only if it doesn't already exist
   * locally.
   *
   * @param {Object} cardData  - The cardData
   * @returns {Promise}        - A promise that returns a number if resolved
   *                             or an error if rejected
   * @resolve {Array}          - An array containing result of this.downloadImage
   *                             and this.writeCardData.
   * @rejects {Error}          - An error which states the cause
   */
  async saveCardData (cardData) {
    let imageWriteP = this.downloadImage(cardData);
    let dataWriteP = this.writeCardData(cardData);
    return Promise.all([imageWriteP, dataWriteP]);
  }

  /**
   * isLocalData
   *
   * Returns a promise of True or False depending on whether or not the
   * card data exists on disk.
   *
   * @param {Object} cardData
   * @returns {Promise}
   * @resolve {Boolean}
   * @rejects {Error}
   */
  isLocalData (cardData) {
    return new Promise((resolve, reject) => {
      let { setAbbr, release, num } = cardData;
      let cardDataPath = path.join(dataDir, setAbbr, release, `${setAbbr}_${release}-${num}.json`);
      let dataOnDisk;
      try {
        dataOnDisk = require(cardDataPath);
        resolve(true);
      } catch (e) {
        resolve(false);
      }
    });
  }


  /**
   * isLocalCard
   *
   * Returns a promise of True or False depending on whether or not the
   * card data exists on disk.
   *
   * @param {String} cardId
   * @returns {Promise}
   * @resolve {Boolean}
   * @rejects {Error}
   */
  isLocalCard (cardId) {
    let cardData = this.parseCardId(cardId);
    return this.isLocalData(cardData);
  }



  /**
   * identifyUrl
   *
   * Identify the type of URL the user is sending us. Can be either:
   *
   *   * card URL
   *   * Set URL
   *   * undefined
   *
   * @param {String} url       - the URL to identify
   * @returns {String} urlType - either, "card", or "set"
   */
   identifyUrl (url) {
    if (cardPageRegex.test(url)) {
      return 'card';
    }
    else if (setPageRegex.test(url)) {
      return 'set';
    }
    else {
      return 'unknown'
    }
  }




  /**
   * rip
   *
   * Rip card data
   *
   * Determines the correct method to use to rip card data based on input.
   * Defers to more specific functions for data rippage.
   *
   * @returns {Promise}        - A promise that returns a string if resolved
   *                             or an error if rejected
   * @resolve {String}         - A report of ripped card data
   * @rejects {Error}          - An error which states the cause
   */
  rip () {
    // throttle the upcoming requests based on the option received
    throttleRequests(httpAgent, (1000 * this.throttle));

    // Determine what the user wants
    if (this.url) {
      console.log(`Ripping ${this.url}`);
      return this.ripUrl(this.url);
    }

    else if (this.set) {
      console.log(`Ripping set ${this.set}`);
      if (this.incremental === true) console.log('incremental mode ON');
      else console.log('incremental mode OFF');
      return this.getSetUrlFromSetAbbr(this.set).then((setUrl) => {
        return this.ripUrl(setUrl);
      });
    }
    else if (this.all) {
      console.log('Ripping all.');
      return this.ripAll();
    }
    else if (this.number) {
      console.log(`ripping ${this.number}`)
      return this.ripCardDataAndSave(this.number);
    }
    else {
      console.error('Rip parameters are indeterminate');
      return Promise.reject('Rip parameters are indeterminate');
    }

  }



  /**
   * getSetUrlFromSetAbbr
   *
   * taking a set abbreviation as it's sole parameter, return a setURL
   * of the card set.
   *
   * @param {String} setAbbr       - The set abbreviation
   * @param {Number} attemptNumber - the number of times getSetUrlFromSetAbbr has

   * @returns {Promise}        - A promise that returns a string if resolved
   *                             or an error if rejected
   * @resolve {String}         - A p-memories.com card set URL
   * @rejects {Error}          - An error which states the cause
   */
  getSetUrlFromSetAbbr (setAbbr, attemptNumber) {
    // 0) check database of mappings from card abbreviations to card set URLs
    // 1) get a sample card from each set in p-memories
    // 2) get the set abbreviation from the card image
    // 3) form a database of mappings from card abbreviations => card set URLs
    if (typeof attemptNumber === 'undefined') attemptNumber = 0;
    attemptNumber += 1;
    let setAbbrIndex;
    try {
      setAbbrIndex = require(setAbbrIndexPath);
      let matchingPair = setAbbrIndex.find((pair) => {
        return pair.setAbbr === setAbbr;
      })
      if (typeof matchingPair === 'undefined') return Promise.reject(
        'matchingPair not found. Check spelling or rebuild setAbbrIndex ($ ./p-data.js index)'
      )
      return Promise.resolve(matchingPair.setUrl);
    }
    catch (e) {
      if (attemptNumber < 2) {
        console.log('Rebuilding Set Abbreviation Index. This may take up to 10 minutes...')
        return this.createSetAbbreviationIndex().then(() => {
          return this.getSetUrlFromSetAbbr(setAbbr, attemptNumber);
        })
      } else {
        return Promise.reject(
          `could not createSetAbbreviationIndex after ${attemptNumber} attempts.`
        )
      }
    }
  };

  /**
   * getImageUrlFromEachSet
   *
   * taking a set abbreviation as it's sole parameter, return a setURL
   * of the card set.
   *
   * @returns {Array}         - A p-memories.com card set URL
   */
  getImageUrlFromEachSet () {
    return this.getSetUrls().then((setUrls) => {
      return Promise.mapSeries(setUrls, (setUrl) => {
        return Promise.props({
          setUrl: this.normalizeUrl(setUrl),
          sampleCardUrl: this.getFirstCardImageUrl(setUrl)
        })
      })
    })
  }


  /**
   * createSetAbbreviationIndex
   *
   * Create a mapping of set abbreviations to set urls.
   * This map is used to get set URLs from a set Abbreviation.
   *
   * @example
   *   [
   *     {
   *       "setAbbr": "SSSS",
   *       "setUrl": "http://p-memories.com/card_product_list_page?field_title_nid=919863-SSSS.GRIDMAN&s_flg=on"
   *     },
   *     ...
   *  ]
   *
   * @returns {Array}         - An array of setAbbr/setUrl pairs
   */
  createSetAbbreviationIndex () {
    return this.getImageUrlFromEachSet().then((imageUrls) => {
      return Promise.map(imageUrls, (imageUrl) => {
        let { sampleCardUrl, setUrl } = imageUrl
        return Promise.props({
          setAbbr: this.getSetAbbrFromImageUrl(sampleCardUrl),
          setUrl: setUrl
        })
      }).then((index) => {
        return fsp.writeFile(
          path.join(__dirname, '..', 'data', 'setAbbrIndex.json'),
          JSON.stringify(index)
        )
      })
    });
  }

  /**
   * getSetAbbrFromImageUrl
   *
   * Determines the set abbreviation given a card image URL.
   *
   * @param {String} imageUrl  - A p-memories card image URL.
   * @returns {String}         - A p-memories set abbreviation.
   */
  getSetAbbrFromImageUrl (imageUrl) {
    debug(`getSetAbbrFromImageUrl() using ${imageUrl} as input`)
    return setAbbrRegex.exec(imageUrl)[1];
  }

  /**
   * getFirstCardImageUrl
   *
   * Accepts a set URL as parameter and returns the URL of the first card in that set.
   *
   * @param {String} setUrl - the URL to the card set
   * @returns {Promise}     - A promise that returns an string if resolved
   *                          or an error if rejected
   * @resolve {String}      - An image URL of the first card in the set
   * @rejects {Error}       - An error which states the cause
   */
  getFirstCardImageUrl (setUrl) {
    debug(`ripping set data from ${setUrl}`);
    setUrl = this.normalizeUrl(setUrl);
    return httpAgent
      .request({ url: setUrl })
      .then((res) => {
        const $ = cheerio.load(res.data);
        if (typeof dataAcc === 'undefined') dataAcc = [];
        let imageSrc = $('td:nth-child(2) a').attr('src');
        return this.normalizeUrl(imageSrc);
      })
    }


    /**
     * parseCardId
     *
     * parses the card ID and returns an object containing
     *   * setAbbr
     *   * release
     *   * number
     *   * num
     *   * id
     *   * variation
     *
     * @param {String} cardId
     * @returns {Promise} - A promise that returns an object if resolved
     *                          or an error if rejected
     * @resolve {Object}
     * @rejects {Error}
     */
    parseCardId (cardId) {
      let parseError = new Error(`cardId is not valid. CardId must be in the format <setAbbr>_<release>-<num>. Got: ${cardId}`);
      let r = cardIdRegex.exec(cardId);
      if (!r) throw parseError;
      let id = r[0];
      let setAbbr = r[1];
      let number = r[2];
      let release = r[3];
      let num = r[4];
      let variation = r[5];
      if (
        typeof number === 'undefined' ||
        typeof setAbbr === 'undefined' ||
        typeof number === 'undefined' ||
        typeof release === 'undefined' ||
        typeof id === 'undefined' ||
        typeof variation === 'undefined'
      )
      throw parseError
      return {
        setAbbr,
        number,
        release,
        num,
        id,
        variation
      }
    }
}

module.exports = Ripper;
