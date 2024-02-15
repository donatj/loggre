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

	getRawEntry() : string {
		return this.log;
	}

	getMessage() : string {
		return this.log.match(/(?<=] ).*/)[0];
	}

	hasDetails() : boolean {
		return this.log.includes("\n");
	}

}