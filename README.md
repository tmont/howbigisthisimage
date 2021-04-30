# howbigisthisimage

A node module that quickly and easily retrieves width/height from local
GIF/PNG/JPEG files. And also MP4 files.

I was annoyed that you have to import huge libraries or resort
to using ImageMagick on the shell to just get the damn dimensions of an
image. I thought we were living in a society.

This has no dependencies and doesn't really do anything besides spit
out the width and height of an image file. And also MP4 files.

## Installation
```bash
npm install howbigisthisimage
```

Or just copy what you need out of `index.js` into your project,
it's like a few hundred lines and barely worth the effort to use NPM.

## Usage
```javascript
const howbig = require('howbigisthisimage');

const png = './image.png';
console.log(await howbig.getPngData(png));
/*
{
    width: 7,
    height: 39,
    bitDepth: 1,
    interlaceMethod: 'none',
    colorType: 0
}
*/

const gif = './image.gif';
console.log(await howbig.getGifData(gif));
/*
{
    width: 7,
    height: 39,
    backgroundColorIndex: null,
    colorResolution: 0,
    pixelAspectRatio: 0,
    pixelAspectRatioComputed: null
}
*/

const jpeg = './image.jpeg';
console.log(await howbig.getJpegData(jpeg));
/*
{
    width: 7,
    height: 39,
    bitsPerSample: 8
}
*/

const mp4 = './movie.mp4';
console.log(await howbig.getMp4Data(mp4));
/*
{
    timescale: 1000,
    duration: 101832,
    durationS: 101.832,
    width: 1178,
    height: 706
}
*/

const unknownImage = './unknown.unknown';
console.log(await howbig.getImageData(unknownImage));
/*
{
    width: 320,
    height: 240,
    // ... other properties dependent on file type
}
*/
```
