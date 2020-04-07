const gm = require('gm');
// const Promise = require('bluebird');
// Promise.promisifyAll(gm.prototype);

// 10 card images wide, 5 card images tall.

class Image {
  constructor (options) {
    if (typeof options === 'undefined') options = {};
    this.cardHeight = options.cardHeight || 182;
    this.cardWidth = options.cardWidth || 130;
    this.mosaicHeight = options.mosaicHeight || 4096;
    this.mosaicWidth = options.mosaicWidth || 4096;
  }

  createCardMosaic (imagePaths) {
    console.log(`+${this.mosaicWidth}+${this.mosaicHeight}`)
    let q = gm()
      .in('-background', 'pink')

    for (var row=0; row<5; row++) {
      for (var col=0; col<10; col++) {
        q.in('-page', `+${col*this.cardWidth}+${row*this.cardHeight}`, imagePaths[row+col])
      }
    }

    return q.mosaic().stream('jpg')
  }
}

module.exports = Image;
