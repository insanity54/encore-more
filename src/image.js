const gm = require('gm');
const debug = require('debug')('encore-more');
const child_process = require('child_process');
// const Promise = require('bluebird');
// Promise.promisifyAll(gm.prototype);

// 10 card images wide, 5 card images tall.
child_process.spawn('gm', ['version'], { stdio: 'inherit' }); // prove gm is installed & operational


class Image {
  constructor (options) {
    if (typeof options === 'undefined') options = {};
    this.cardHeight = options.cardHeight || 182;
    this.cardWidth = options.cardWidth || 130;
    this.mosaicHeight = options.mosaicHeight || 4096;
    this.mosaicWidth = options.mosaicWidth || 4096;
  }

  randomColor () {
    let items = [
      'red',
      'blue',
      'yellow',
      'green',
      'orange',
      'cyan',
      'lime',
      'black',
      'white',
      'purple'
    ]
    var item = items[Math.floor(Math.random() * items.length)];
    return item;
  }

  createCardMosaic (imagePaths) {
    let q = gm()
      .in('-background', 'pink')
      .in('-pointsize', '42')
      // .append(imagePaths[0])

    let cardIndex=0;
    for (var row=0; row<5; row++) {
      for (var col=0; col<10; col++) {
        debug(`col:${col}, row:${row}, cardIndex:${cardIndex}, x:${col*this.cardWidth}, y:${row*this.cardHeight}`)
        q.in('-gravity', 'Center')
        q.in('-page', `+${col*this.cardWidth}+${row*this.cardHeight}`)
        // q.in('-fill', 'white')
        // q.in('-stroke', 'black')
        // q.in('-draw', `text 0,0 i${cardIndex}`)
        q.in(imagePaths[cardIndex])
        q.in('-rotate', '+90>')
        cardIndex++;
      }
    }

    debug(q);

    return q
      // .scale(409, 409)
      // .resize(this.mosaicWidth)
      // .mosaic()
      .in('-mosaic')
      .stream('jpg')
  }
}

module.exports = Image;
