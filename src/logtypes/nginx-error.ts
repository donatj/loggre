import { LogEntry, LogType } from "./Logs";

export class NginxErrorLog implements LogType {

	looksLikeLogLine(line: string): boolean {
		return /^\d\d\d\d\/\d\d\/\d\d \d\d:\d\d:\d\d \[/.test(line)
	}

	parseLogLine(line: string): LogEntry {
		return new NginxErrorLogEntry(line);
	}

}

export class NginxErrorLogEntry implements LogEntry {

	constructor(public readonly log: string) {
		this.log = this.log.trim();
	}

	getRawEntry(): string {
		return this.log;
	}

	getMessage(): string {
		const match = this.log.match(/(?<=] \S+ \S+ ).*/);
		return match ? match[0] : ""; // @todo Throw an error if no match found?
	}

	getDate(): Date {
		var match = this.log.match(/^(\d\d\d\d\/\d\d\/\d\d \d\d:\d\d:\d\d) \[/);
		if (match != null && match[1] !== undefined) {
			const date = new Date(match[1]);
			if (isNaN(date.getTime())) {
				throw new Error("Log entry does not contain a valid date format: " + match[1]);
			}

			return date;
		} else {
			throw new Error("Log entry does not contain a valid date.");
		}
	}

	hasDetails(): boolean {
		return this.log.includes("\n");
	}

}