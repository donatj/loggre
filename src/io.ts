import { LogEntry, LogType } from "./logtypes/Logs";
import { Decompress, DecodeUTF8 } from "fflate";

export interface ProgressHandler {
	start(total: number): void;
	progress(numerator: number, denominator: number): Promise<void>;
	finish(): void;
}

export async function* getAllLogs(
	files: File[],
	logType: LogType,
	progress?: ProgressHandler
): AsyncGenerator<LogEntry> {
	console.log(progress)
	progress?.start(files.length);
	for (const file of files) {
		for await (const logEntry of getLogs(file, logType)) {
			yield logEntry;
		}

		if (progress) {
			await progress.progress(files.indexOf(file) + 1, files.length);
		}
	}

	progress?.finish();
}

export async function* getLogs(file: File, type: LogType): AsyncGenerator<LogEntry> {
	let log = "";
	for await (const line of getLines(file)) {
		if (type.looksLikeLogLine(line)) {
			if (log) {
				yield type.parseLogLine(log);
			}
			log = line;
		} else {
			log += "\n" + line;
		}
	}

	if (log) {
		yield type.parseLogLine(log);
	}
}

export async function* getLines(file: File): AsyncGenerator<string> {
	const reader = file.stream().getReader();

	// Read the first chunk to check for gzip magic bytes
	let { value: firstChunk, done: readerDone } = await reader.read();
	if (!firstChunk) {
		return;
	}

	// Check if file is gzipped by looking for magic bytes (0x1f, 0x8b)
	const isGzipped = firstChunk.length >= 2 && firstChunk[0] === 0x1f && firstChunk[1] === 0x8b;

	if (isGzipped) {
		// Handle gzipped content using fflate streaming
		yield* getLinesFromGzipped(reader, firstChunk);
	} else {
		// Handle uncompressed content
		yield* getLinesFromUncompressed(reader, firstChunk, readerDone);
	}
}

async function* getLinesFromGzipped(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	firstChunk: Uint8Array
): AsyncGenerator<string> {
	let textBuffer = "";
	let isDecompressionComplete = false;
	let decompressError: Error | null = null;

	// Create decompression stream with proper error handling
	const decompress = new Decompress((chunk, final) => {
		if (chunk) {
			// Decode the decompressed chunk to text
			const decoder = new TextDecoder("utf-8");
			const text = decoder.decode(chunk, { stream: !final });
			textBuffer += text;
		}
		if (final) {
			isDecompressionComplete = true;
		}
	});

	// Process the first chunk
	try {
		decompress.push(firstChunk);
	} catch (err) {
		decompressError = err instanceof Error ? err : new Error(String(err));
	}

	// Continue reading and decompressing
	let readerDone = false;
	while (!readerDone && !isDecompressionComplete && !decompressError) {
		const { value: chunk, done } = await reader.read();
		readerDone = done;

		try {
			if (chunk) {
				decompress.push(chunk, done);
			} else if (done) {
				decompress.push(new Uint8Array(0), true);
			}
		} catch (err) {
			decompressError = err instanceof Error ? err : new Error(String(err));
			break;
		}

		// Yield complete lines from the text buffer
		yield* extractLinesFromBuffer(textBuffer, false);
		textBuffer = getRemainingBuffer(textBuffer);
	}

	// Handle any decompression error
	if (decompressError) {
		throw decompressError;
	}

	// Process any remaining text in the buffer
	if (textBuffer.length > 0) {
		yield* extractLinesFromBuffer(textBuffer, true);
	}
}

async function* getLinesFromUncompressed(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	firstChunk: Uint8Array,
	initialReaderDone: boolean
): AsyncGenerator<string> {
	const decoder = new TextDecoder("utf-8");
	let chunkText = decoder.decode(firstChunk, { stream: true });
	let readerDone = initialReaderDone;

	const re = /\r\n|\n|\r/gm;
	let startIndex = 0;

	while (true) {
		const result = re.exec(chunkText);
		if (!result) {
			if (readerDone) {
				break;
			}
			const remainder = chunkText.substr(startIndex);
			const { value: rawChunk, done } = await reader.read();
			readerDone = done;
			chunkText = remainder + (rawChunk ? decoder.decode(rawChunk, { stream: true }) : "");
			startIndex = 0;
			continue;
		}
		yield chunkText.substring(startIndex, result.index);
		startIndex = re.lastIndex;
	}

	// Yield any remaining line after the last newline character
	if (startIndex < chunkText.length) {
		yield chunkText.substr(startIndex);
	}
}

function* extractLinesFromBuffer(buffer: string, isFinal: boolean): Generator<string> {
	const re = /\r\n|\n|\r/gm;
	let startIndex = 0;
	let result;

	while ((result = re.exec(buffer)) !== null) {
		yield buffer.substring(startIndex, result.index);
		startIndex = re.lastIndex;
	}

	// If this is the final chunk and there's remaining text, yield it
	if (isFinal && startIndex < buffer.length) {
		yield buffer.substr(startIndex);
	}
}

function getRemainingBuffer(buffer: string): string {
	const re = /\r\n|\n|\r/gm;
	let lastNewlineIndex = -1;
	let result;

	while ((result = re.exec(buffer)) !== null) {
		lastNewlineIndex = re.lastIndex;
	}

	// Return text after the last newline, or empty string if no newlines found
	return lastNewlineIndex >= 0 ? buffer.substr(lastNewlineIndex) : buffer;
}
