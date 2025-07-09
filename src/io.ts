import { LogEntry, LogType } from "./logtypes/Logs";
import { Decompress } from "fflate";

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
	progress?.start(files.length);
	for (const file of files) {
		yield* getLogs(file, logType);

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
	const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
	const isGzipped = header[0] === 0x1f && header[1] === 0x8b;

	if (isGzipped) {
		// Handle gzipped content using fflate streaming
		yield* getLinesFromGzipped(file);
	} else {
		// Handle uncompressed content
		yield* getLinesFromUncompressed(file);
	}
}

async function* getLinesFromGzipped(
	file: File
): AsyncGenerator<string> {
	const reader = file.stream().getReader();
	const decoder = new TextDecoder("utf-8");

	let textBuffer = "";
	let isDecompressionComplete = false;
	let decompressError: Error | null = null;

	// Create decompression stream with proper error handling
	const decompress = new Decompress((chunk, final) => {
		if (chunk) {
			// Decode the decompressed chunk to text
			const text = decoder.decode(chunk, { stream: !final });
			textBuffer += text;
		}
		if (final) {
			isDecompressionComplete = true;
		}
	});

	// Process chunks from the stream
	let readerDone = false;
	while (true) {
		if (readerDone || isDecompressionComplete || decompressError) {
			break;
		}

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
	file: File
): AsyncGenerator<string> {
	const reader = file.stream().getReader();
	const decoder = new TextDecoder("utf-8");

	let { value: rawChunk, done: readerDone } = await reader.read();
	let chunkText = rawChunk ? decoder.decode(rawChunk, { stream: true }) : "";

	const re = /\r\n|\n|\r/gm;
	let startIndex = 0;

	while (true) {
		const result = re.exec(chunkText);
		if (!result) {
			if (readerDone) {
				break;
			}
			const remainder = chunkText.substr(startIndex);
			const { value: newRawChunk, done } = await reader.read();
			readerDone = done;
			chunkText = remainder + (newRawChunk ? decoder.decode(newRawChunk, { stream: true }) : "");
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

	while (true) {
		result = re.exec(buffer);
		if (result === null) {
			break;
		}
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

	while (true) {
		const result = re.exec(buffer);
		if (result === null) {
			break;
		}
		lastNewlineIndex = re.lastIndex;
	}

	// Return text after the last newline, or empty string if no newlines found
	return lastNewlineIndex >= 0 ? buffer.substr(lastNewlineIndex) : buffer;
}
