const gm = require('gm');
const Promise = require('bluebird');


class Image {
  constructor (options) {
    if (typeof options === 'undefined') options = {};
    this.cardHeight = options.cardheight || 182;
    this.cardWidth = options.cardwiddth || 130;
    this.mosaicHeight = options.mosaicHeight || 4096;
    this.mosaicWidth = options.mosaicWidth || 4096;
  }

  createCardMosaic (imagePaths) {
    return new Promise.each(imagePaths, (imagePath) => {
      gm('')
    }).then()
  }


}

module.exports = Image;
