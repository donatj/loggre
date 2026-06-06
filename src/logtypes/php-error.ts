import { LogEntry, LogType } from "./Logs";

export class PhpErrorLog implements LogType {

	looksLikeLogLine(line: string): boolean {
		return line[0] === '[';
	}

	parseLogLine(line: string): LogEntry {
		return new PhpErrorLogEntry(line);
	}

}

export class PhpErrorLogEntry implements LogEntry {

	constructor(public readonly log: string) {
		this.log = this.log.trim();
	}

	getRawEntry(): string {
		return this.log;
	}

	getMessage(): string {
		const match = this.log.match(/(?<=] ).*/);
		return match ? match[0] : ""; // @todo Throw an error if no match found?
	}

	getDate(): Date {
		const match = this.log.match(/\[(.*?)\]/);
		if (!match) {
			throw new Error("Log entry does not contain a valid date.");
		}

		const date = new Date(match[1]);
		if (isNaN(date.getTime())) {
			throw new Error("Log entry does not contain a valid date format: " + match[1]);
		}

		return date;
	}

	hasDetails(): boolean {
		return this.log.includes("\n");
	}

}
