import { LogEntry, LogType } from "./logtypes/Logs";

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
	const decoder = new TextDecoder("utf-8");
	const reader = file.stream().getReader();

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
			({ value: rawChunk, done: readerDone } = await reader.read());
			chunkText = remainder + (rawChunk ? decoder.decode(rawChunk, { stream: true }) : "");
			startIndex = 0;
			continue;
		}
		yield chunkText.substring(startIndex, result.index); // Yielding each line
		startIndex = re.lastIndex;
	}
	// Yield any remaining line after the last newline character
	if (startIndex < chunkText.length) {
		yield chunkText.substr(startIndex);
	}
}