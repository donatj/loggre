

export interface LogType {
	looksLikeLogLine(line: string): boolean;
	parseLogLine(line: string): LogEntry;
}

export interface LogEntry {
	getRawEntry() : string;
	getMessage() : string;
	getDate() : Date;
	hasDetails() : boolean;
}

export type LogFilter = (logEntry: LogEntry) => boolean;

export function AfterFilter(date: Date): LogFilter {
	return (logEntry: LogEntry) => logEntry.getDate() >= date;
}

export function BeforeFilter(date: Date): LogFilter {
	return (logEntry: LogEntry) => logEntry.getDate() <= date;
}

export function AndFilter(...filters: LogFilter[]): LogFilter {
	return (logEntry: LogEntry) => filters.every(f => f(logEntry));
}

export function OrFilter(...filters: LogFilter[]): LogFilter {
	return (logEntry: LogEntry) => filters.some(f => f(logEntry));
}

export async function* applyFilter(logs: AsyncGenerator<LogEntry>, filter: LogFilter): AsyncGenerator<LogEntry> {
	for await (const log of logs) {
		if (filter(log)) {
			yield log;
		}
	}
}
