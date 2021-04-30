const fs = require('fs');

const promiseMe = (fn) => {
	return new Promise((resolve, reject) => {
		fn((err, result) => {
			if (err) {
				reject(err);
				return;
			}

			resolve(result);
		});
	});
};

// https://en.wikipedia.org/wiki/Portable_Network_Graphics#Critical_chunks
// https://www.w3.org/TR/PNG-Chunks.html
exports.getPngData = async (filename) => {
	const fd = await promiseMe(callback => fs.open(filename, 'r', callback));

	try {
		let offset = 8; // header is 8 bytes, and we don't care about it
		const buffer = Buffer.alloc(8);
		await promiseMe(callback => fs.read(fd, buffer, 0, 8, offset, callback));
		if (buffer.compare(Buffer.from('IHDR'), 0, 4, 4) !== 0) {
			throw new Error(`IHDR chunk not found`);
		}

		const len = buffer.readUInt32BE(0);
		if (len !== 13) {
			throw new Error(`IHDR chunk should be exactly 13 bytes, got ${len}`);
		}
		offset += buffer.byteLength;
		const data = Buffer.alloc(len);
		await promiseMe(callback => fs.read(fd, data, 0, len, offset, callback));

		const width = data.readUInt32BE(0);
		const height = data.readUInt32BE(4);
		const bitDepth = data.readUInt8(8);
		const colorType = data.readUInt8(9);
		const interlaceMethod = data.readUInt8(12);

		return {
			width,
			height,
			bitDepth,
			colorType,
			interlaceMethod: interlaceMethod === 1 ? 'Adam7' : 'none',
		};
	} finally {
		await promiseMe(callback => fs.close(fd, callback));
	}
};

// https://www.w3.org/Graphics/GIF/spec-gif89a.txt
// http://giflib.sourceforge.net/whatsinagif/bits_and_bytes.html
exports.getGifData = async (filename) => {
	const fd = await promiseMe(callback => fs.open(filename, 'r', callback));

	try {
		let offset = 6; // header is 6 bytes, and we don't care about it

		const data = Buffer.alloc(6);
		const bytesRead = await promiseMe(callback => fs.read(fd, data, 0, 6, offset, callback));
		if (bytesRead !== 6) {
			throw new Error(`Logical screen descriptor is missing or malformed`);
		}

		const width = data.readUInt16LE(0);
		const height = data.readUInt16LE(2);
		const bgColorIndex = data.readUInt8(4);
		const pixelAspectRatio = data.readUInt8(5);

		const info = data.readUInt8(3);
		const hasGlobalColorTable = info & 0b10000000 === 0b10000000;
		const colorResolution = info & 0b01110000 >> 4;

		return {
			width,
			height,
			backgroundColorIndex: hasGlobalColorTable ? bgColorIndex : null,
			pixelAspectRatio,
			pixelAspectRatioComputed: pixelAspectRatio > 0 ? (pixelAspectRatio + 15) / 64 : null,
			colorResolution,

		};
	} finally {
		await promiseMe(callback => fs.close(fd, callback));
	}
};

// https://en.wikipedia.org/wiki/JPEG#Syntax_and_structure
// http://www.vip.sugovica.hu/Sardi/kepnezo/JPEG%20File%20Layout%20and%20Format.htm
exports.getJpegData = async (filename) => {
	const fd = await promiseMe(callback => fs.open(filename, 'r', callback));

	try {
		let offset = 2; // header is 2 bytes, and we don't care about it

		while (true) {
			const data = Buffer.alloc(2);
			const bytesRead = await promiseMe(callback => fs.read(fd, data, 0, 2, offset, callback));
			if (!bytesRead) {
				throw new Error(`Reached EOF without finding SOF marker`);
			}

			if (data[0] !== 0xFF) {
				throw new Error(`Unknown byte value "${data[0]}" at offset ${offset}`);
			}

			offset += 2;

			const getMarkerLength = async () => {
				const buf = Buffer.alloc(2);
				const bytesRead = await promiseMe(callback => fs.read(fd, buf, 0, 2, offset, callback));
				if (bytesRead !== 2) {
					throw new Error(`Failed to read two bytes at offset ${offset}`);
				}

				return buf.readUInt16BE(0);
			};

			const consumeMarker = async () => {
				// length includes the two marker length bytes
				offset += await getMarkerLength();
			};

			switch (data[1]) {
				case 0xC0:
				case 0xC2: {
					const len = await getMarkerLength();

					const payload = Buffer.alloc(len);
					const bytesRead = await promiseMe(callback => fs.read(fd, payload, 0, len, offset + 2, callback));
					if (bytesRead !== len) {
						throw new Error(`Failed to read ${len} bytes for SOF marker payload (read ${bytesRead})`);
					}
					const bitsPerSample = payload.readUInt8(0);
					const height = payload.readUInt16BE(1);
					const width = payload.readUInt16BE(3);

					return {
						width,
						height,
						bitsPerSample,
					};
				}
				case 0xD0:
				case 0xD1:
				case 0xD2:
				case 0xD3:
				case 0xD4:
				case 0xD5:
				case 0xD6:
				case 0xD7:
				case 0xD8:
				case 0xD9:
					// 0 bytes
					break;
				default:
					// just try to consume the marker, even if we don't recognize it
					await consumeMarker();
					break;
			}
		}
	} finally {
		await promiseMe(callback => fs.close(fd, callback));
	}
}

const gif87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const gif89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpeg = [0xff, 0xd8];

exports.getImageData = async (filename) => {
	const maxBytes = [ gif87, gif89, png, jpeg ].reduce((max, arr) => Math.max(max, arr.length), 0);
	const fd = await promiseMe(callback => fs.open(filename, 'r', callback));
	const matches = (buffer, bytes) => {
		for (let i = 0; i < bytes.length; i++) {
			if (buffer[i] !== bytes[i]) {
				return false;
			}
		}

		return true;
	};

	const buffer = Buffer.alloc(maxBytes);
	await promiseMe(callback => fs.read(fd, buffer, 0, maxBytes, 0, callback));
	await promiseMe(callback => fs.close(fd, callback));
	if (matches(buffer, jpeg)) {
		return exports.getJpegData(filename);
	}
	if (matches(buffer, png)) {
		return exports.getPngData(filename);
	}
	if (matches(buffer, gif89) || matches(buffer, gif87)) {
		return exports.getGifData(filename);
	}

	throw new Error(`Unable to detect PNG/JPEG/GIF magic number in "${filename}"`);
};

// https://xhelmboyx.tripod.com/formats/mp4-layout.txt
exports.getMp4Data = async (filename) => {
	const fd = await promiseMe(callback => fs.open(filename, 'r', callback));

	try {
		let offset = 0;

		const getBoxInfo = async (offset) => {
			try {
				let data = Buffer.alloc(8);
				const read = await promiseMe(callback => fs.read(fd, data, 0, 8, offset, callback));
				if (read !== 8) {
					return null;
				}
				return {
					length: data.readUInt32BE(0),
					type: data.slice(4).toString('ascii'),
				};
			} catch (e) {
				return null;
			}
		};

		const parseTrack = async () => {
			while (true) {
				const info = await getBoxInfo(offset);
				if (!info) {
					return null;
				}

				if (info.type !== 'tkhd') {
					offset += info.length;
					continue;
				}

				offset += 8;

				const dataLen = info.length - 8;
				if (!dataLen) {
					continue;
				}

				const data = Buffer.alloc(dataLen);
				const read = await promiseMe(callback => fs.read(fd, data, 0, dataLen, offset, callback));
				if (read !== dataLen) {
					throw new Error(`Failed to read ${dataLen} bytes at offset ${offset}`);
				}

				let localOffset = 0;
				const version = data.readUInt8(0);
				localOffset += 4; // skipping 24-bit "hex flags"

				// creation/modification times
				if (version === 1) {
					localOffset += 16;
				} else {
					localOffset += 8;
				}

				localOffset += 4; // track id
				localOffset += 8; // reserved bytes

				// duration
				if (version === 1) {
					localOffset += 8;
				} else {
					localOffset += 4;
				}

				localOffset += 4; // reserved bytes
				localOffset += 2; // video layer
				localOffset += 2; // other track id
				localOffset += 2; // volume
				localOffset += 2; // reserved
				localOffset += 36; // geometry

		        const frameWidth = data.readUInt32BE(localOffset) / 0x10000;
		        const frameHeight = data.readUInt32BE(localOffset + 4) / 0x10000;

				offset += dataLen;
				return {
					frameWidth,
					frameHeight,
				};
			}
		};

		const parseMoov = async () => {
			const movieData = {};

			let foundFrameSize = false;
			let foundDuration = false;

			while (true) {
				const info = await getBoxInfo(offset);
				if (!info) {
					return null;
				}

				if (info.type === 'mvhd') {
					offset += 8;
					const dataLen = info.length - 8;
					if (!dataLen) {
						continue;
					}

					const data = Buffer.alloc(dataLen);
					const read = await promiseMe(callback => fs.read(fd, data, 0, dataLen, offset, callback));
					if (read !== dataLen) {
						throw new Error(`Failed to read ${dataLen} bytes at offset ${offset}`);
					}

					let localOffset = 0;
					let duration;
					const version = data.readUInt8(0);

					localOffset += 4; // skipping 24-bit "hex flags"
					if (version === 1) {
						localOffset += 16;
					} else {
						localOffset += 8;
					}

					const timescale = data.readUInt32BE(localOffset);
					if (!timescale) {
						throw new Error(`time scale is zero at offset ${localOffset}`);
					}
					localOffset += 4;

					if (version === 1) {
						duration = data.readBigUInt64BE(localOffset);
						localOffset += 8;
					} else {
						duration = data.readUInt32BE(localOffset);
						localOffset += 4;
					}

					movieData.timescale = timescale;
					movieData.duration = duration;
					movieData.durationS = duration / timescale;
					foundDuration = true;
					offset += dataLen;
					if (foundFrameSize) {
						break;
					}
				} else if (info.type === 'trak') {
					offset += 8;
					const result = await parseTrack();
					if (result) {
						movieData.width = result.frameWidth;
						movieData.height = result.frameHeight;
						foundFrameSize = true;
						if (foundDuration) {
							break;
						}
					}
				} else {
					offset += info.length;
				}
			}

			if (!foundFrameSize || !foundDuration) {
				return null;
			}

			return movieData;
		};

		while (true) {
			const info = await getBoxInfo(offset);
			if (!info) {
				throw new Error(`Failed to find relevant moov or tkhd boxes`);
			}

			if (info.type === 'moov') {
				offset += 8;
				const result = await parseMoov();
				if (!result) {
					continue;
				}

				return result;
			}

			if (!info.length) {
				// prevent infinite loops for malformed data
				throw new Error(`Failed to read box length at offset ${offset}`);
			}

			offset += info.length;
		}
	} finally {
		await promiseMe(callback => fs.close(fd, callback));
	}
};
