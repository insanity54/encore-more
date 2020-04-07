const assert = require('chai').assert;
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const Ripper = require('../src/ripper');
const Readable = require('stream').Readable;
const gm = require('gm');
let ripper = new Ripper();


describe('ripper.js', function () {
  describe('getDeckImage', function () {
    it('should return a readable stream', function () {
      this.timeout(30000);
      return ripper.getDeckImage('ZT1ZXFQkp').then((imageStream) => {
        console.log(imageStream)
        assert.instanceOf(imageStream, Readable);
        imageStream.pipe(fs.createWriteStream('/dev/null'))
      })
    })
  })
  describe('ripDeckData', function () {
    it('should resolve an array containing card image URLs', function () {
      this.timeout(30000);
      return ripper.ripDeckData('ZT1ZXFQkp').then((cardImageUrls) => {
        assert.isArray(cardImageUrls);
        assert.lengthOf(cardImageUrls, 50);
        assert.isString(cardImageUrls[0]);
      });
    })
  })
  describe('downloadCardImage', function () {
    it('should resolve a absolute path to the saved image on disk', function () {
      this.timeout(15000);
      return ripper.downloadCardImage('https://www.encoredecks.com/images/EN/S29/E032.gif').then((imagePath) => {
        assert.isString(imagePath);
        gm(imagePath).command('identify')
      });
    })
  })
})
