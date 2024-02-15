

export interface LogType {
	looksLikeLogLine(line: string): boolean;
	parseLogLine(line: string): LogEntry;
}

export interface LogEntry {
	getRawEntry() : string;
	getMessage() : string;
	hasDetails() : boolean;
}
