const path = require('path');
const expect = require('expect.js');
const howbig = require('../');

describe('how big is this image', () => {
	const getTestFile = filename => path.join(__dirname, 'files', filename);

	it('should get data from PNG', async () => {
		const file = getTestFile('7x39.png')
		const result = await howbig.getPngData(file);
		expect(result).to.eql({
			width: 7,
			height: 39,
			bitDepth: 1,
			interlaceMethod: 'none',
			colorType: 0,
		});
	});

	it('should get data from PNG implicitly', async () => {
		const file = getTestFile('7x39.png');
		const result = await howbig.getImageData(file);
		expect(result).to.eql({
			width: 7,
			height: 39,
			bitDepth: 1,
			interlaceMethod: 'none',
			colorType: 0,
		});
	});

	it('should get data from PNG with alpha channel', async () => {
		const file = getTestFile('alpha.png');
		const result = await howbig.getPngData(file);
		expect(result).to.eql({
			width: 100,
			height: 50,
			bitDepth: 2,
			interlaceMethod: 'none',
			colorType: 3,
		});
	});

	it('should get data from GIF', async () => {
		const file = getTestFile('7x39.gif');
		const result = await howbig.getGifData(file);
		expect(result).to.eql({
			width: 7,
			height: 39,
			backgroundColorIndex: null,
			colorResolution: 0,
			pixelAspectRatio: 0,
			pixelAspectRatioComputed: null,
		});
	});

	it('should get data from GIF implicitly', async () => {
		const file = getTestFile('7x39.gif');
		const result = await howbig.getImageData(file);
		expect(result).to.eql({
			width: 7,
			height: 39,
			backgroundColorIndex: null,
			colorResolution: 0,
			pixelAspectRatio: 0,
			pixelAspectRatioComputed: null,
		});
	});

	it('should get data from JPEG', async () => {
		const file = getTestFile('7x39.jpeg');
		const result = await howbig.getJpegData(file);
		expect(result).to.eql({
			width: 7,
			height: 39,
			bitsPerSample: 8,
		});
	});

	it('should get data from JPEG implicitly', async () => {
		const file = getTestFile('7x39.jpeg');
		const result = await howbig.getImageData(file);
		expect(result).to.eql({
			width: 7,
			height: 39,
			bitsPerSample: 8,
		});
	});

	it('should throw error if magic number is not detected', async () => {
		try {
			await howbig.getImageData(getTestFile('invalid.txt'));
		} catch (e) {
			expect(e).to.have.property('message',
				`Unable to detect PNG/JPEG/GIF magic number in "${getTestFile('invalid.txt')}"`);
			return;
		}

		throw new Error('expected error to be thrown');
	});

	it('should throw error if not a valid JPEG', async () => {
		try {
			await howbig.getJpegData(getTestFile('invalid.txt'));
		} catch (e) {
			expect(e).to.have.property('message').match(/^Unknown byte value/);
			return;
		}

		throw new Error('expected error to be thrown');
	});

	it('should throw error if not a valid PNG', async () => {
		try {
			await howbig.getPngData(getTestFile('invalid.txt'));
		} catch (e) {
			expect(e).to.have.property('message', 'IHDR chunk not found');
			return;
		}

		throw new Error('expected error to be thrown');
	});

	it('should throw error if not a valid GIF', async () => {
		try {
			await howbig.getGifData(getTestFile('invalid.txt'));
		} catch (e) {
			expect(e).to.have.property('message', 'Logical screen descriptor is missing or malformed');
			return;
		}

		throw new Error('expected error to be thrown');
	});

	it('should get MP4 data', async () => {
		const result = await howbig.getMp4Data(getTestFile('test.mp4'));
		expect(result).to.eql({
			timescale: 1000,
			duration: 3640,
			durationS: 3.64,
			width: 320,
			height: 240,
		});
	});
});
