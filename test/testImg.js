const assert = require('chai').assert;
const fs = require('fs');
// const path = require('path');
// const Promise = require('bluebird');
const Image = require('../src/image');
const Readable = require('stream').Readable;
const { testImagePaths } = require('../fixtures/fixtures');



describe('image.js', function () {
  describe('createCardMosaic', function () {
    it('should return a readable stream', function () {
      const img = new Image();
      let ccm = img.createCardMosaic(testImagePaths)
      assert.instanceOf(ccm, Readable);
      ccm.pipe(fs.createWriteStream('/dev/null')); //pipe(fs.createWriteStream('/home/chris/Documents/encore-more/data/fart.jpg'));
    });
  })
})
