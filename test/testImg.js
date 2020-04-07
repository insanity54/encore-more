const assert = require('chai').assert;
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const Image = require('../src/image');
const img = new Image();
const Readable = require('stream').Readable;
const { testImagePaths } = require('../fixtures/fixtures');




describe('image.js', function () {
  describe('createCardMosaic', function () {

    let ccm = img.createCardMosaic(testImagePaths)
    assert.instanceOf(ccm, Promise)
    // console.log(ccm);
    // console.log(typeof ccm);

    return ccm.then((imageContent) => {
      console.log('hi there')
      console.log(imageContent)
      assert.instanceOf(imageContent, Readable);
    }).catch((e) => {
      throw e;
    })
  })
})
