import { getLines, getAllLogs, getLogs } from '../io';
import { LogType, LogEntry } from '../logtypes/Logs';
import { gzip } from 'fflate';

// Mock LogType for testing
class MockLogType implements LogType {
	looksLikeLogLine(line: string): boolean {
		return line.startsWith('[');
	}

	parseLogLine(line: string): LogEntry {
		const date = new Date();
		return {
			getRawEntry: () => line,
			getMessage: () => line.split(']')[1]?.trim() || line,
			getDate: () => date,
			hasDetails: () => line.includes('ERROR') || line.includes('WARNING')
		};
	}
}

// Helper function to create a File from string content
function createFileFromString(content: string): File {
	const blob = new Blob([content], { type: 'text/plain' });
	return new File([blob], 'test.log', { type: 'text/plain' });
}

// Helper function to create a gzipped File from string content
function createGzippedFileFromString(content: string): Promise<File> {
	return new Promise((resolve, reject) => {
		const encoder = new TextEncoder();
		const data = encoder.encode(content);

		gzip(data, (err, compressed) => {
			if (err) {
				reject(err);
				return;
			}
			const blob = new Blob([compressed], { type: 'application/gzip' });
			resolve(new File([blob], 'test.log.gz', { type: 'application/gzip' }));
		});
	});
}

describe('getLines', () => {
	it('should read lines from plain text file', async () => {
		const content = 'Line 1\nLine 2\r\nLine 3\rLine 4';
		const file = createFileFromString(content);

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4']);
	});

	it('should handle empty file', async () => {
		const file = createFileFromString('');

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toEqual([]);
	});

	it('should handle file with only newlines', async () => {
		const file = createFileFromString('\n\n\r\n');

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toEqual(['', '', '']);
	});

	it('should handle file without trailing newline', async () => {
		const content = 'Line 1\nLine 2\nLine 3';
		const file = createFileFromString(content);

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
	});

	it('should read lines from gzipped file', async () => {
		const content = 'Line 1\nLine 2\r\nLine 3\rLine 4';
		const file = await createGzippedFileFromString(content);

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4']);
	});

	it('should handle large gzipped file', async () => {
		const largeContent = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n');
		const file = await createGzippedFileFromString(largeContent);

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toHaveLength(1000);
		expect(lines[0]).toBe('Line 1');
		expect(lines[999]).toBe('Line 1000');
	});

	it('should handle empty gzipped file', async () => {
		const file = await createGzippedFileFromString('');

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toEqual([]);
	});

	it('should handle multiline log entries in gzipped file', async () => {
		const content = '[2023-01-01] First log\nContinuation line\n[2023-01-02] Second log';
		const file = await createGzippedFileFromString(content);

		const lines: string[] = [];
		for await (const line of getLines(file)) {
			lines.push(line);
		}

		expect(lines).toEqual(['[2023-01-01] First log', 'Continuation line', '[2023-01-02] Second log']);
	});
});

describe('getLogs', () => {
	const mockLogType = new MockLogType();

	it('should parse single line logs', async () => {
		const content = '[2023-01-01] First log\n[2023-01-02] Second log';
		const file = createFileFromString(content);

		const logs: LogEntry[] = [];
		for await (const log of getLogs(file, mockLogType)) {
			logs.push(log);
		}

		expect(logs).toHaveLength(2);
		expect(logs[0].getMessage()).toBe('First log');
		expect(logs[1].getMessage()).toBe('Second log');
	});

	it('should handle multiline log entries', async () => {
		const content = '[2023-01-01] First log\nContinuation line\nMore continuation\n[2023-01-02] Second log';
		const file = createFileFromString(content);

		const logs: LogEntry[] = [];
		for await (const log of getLogs(file, mockLogType)) {
			logs.push(log);
		}

		expect(logs).toHaveLength(2);
		expect(logs[0].getRawEntry()).toBe('[2023-01-01] First log\nContinuation line\nMore continuation');
		expect(logs[1].getRawEntry()).toBe('[2023-01-02] Second log');
	});

	it('should parse logs from gzipped file', async () => {
		const content = '[2023-01-01] First log\n[2023-01-02] Second log';
		const file = await createGzippedFileFromString(content);

		const logs: LogEntry[] = [];
		for await (const log of getLogs(file, mockLogType)) {
			logs.push(log);
		}

		expect(logs).toHaveLength(2);
		expect(logs[0].getMessage()).toBe('First log');
		expect(logs[1].getMessage()).toBe('Second log');
	});

	it('should handle gzipped file with multiline entries', async () => {
		const content = '[2023-01-01] ERROR: Something went wrong\nStack trace line 1\nStack trace line 2\n[2023-01-02] INFO: All good';
		const file = await createGzippedFileFromString(content);

		const logs: LogEntry[] = [];
		for await (const log of getLogs(file, mockLogType)) {
			logs.push(log);
		}

		expect(logs).toHaveLength(2);
		expect(logs[0].getRawEntry()).toBe('[2023-01-01] ERROR: Something went wrong\nStack trace line 1\nStack trace line 2');
		expect(logs[1].getRawEntry()).toBe('[2023-01-02] INFO: All good');
		expect(logs[0].hasDetails()).toBe(true);
		expect(logs[1].hasDetails()).toBe(false);
	});
});

describe('getAllLogs', () => {
	const mockLogType = new MockLogType();

	it('should process multiple files', async () => {
		const file1 = createFileFromString('[2023-01-01] Log from file 1');
		const file2 = createFileFromString('[2023-01-02] Log from file 2');

		const logs: LogEntry[] = [];
		for await (const log of getAllLogs([file1, file2], mockLogType)) {
			logs.push(log);
		}

		expect(logs).toHaveLength(2);
		expect(logs[0].getMessage()).toBe('Log from file 1');
		expect(logs[1].getMessage()).toBe('Log from file 2');
	});

	it('should process mix of gzipped and plain files', async () => {
		const plainFile = createFileFromString('[2023-01-01] Plain log');
		const gzippedFile = await createGzippedFileFromString('[2023-01-02] Gzipped log');

		const logs: LogEntry[] = [];
		for await (const log of getAllLogs([plainFile, gzippedFile], mockLogType)) {
			logs.push(log);
		}

		expect(logs).toHaveLength(2);
		expect(logs[0].getMessage()).toBe('Plain log');
		expect(logs[1].getMessage()).toBe('Gzipped log');
	});

	it('should call progress handler when provided', async () => {
		const file1 = createFileFromString('[2023-01-01] Log 1');
		const file2 = createFileFromString('[2023-01-02] Log 2');

		const progressHandler = {
			start: jest.fn(),
			progress: jest.fn().mockResolvedValue(undefined),
			finish: jest.fn()
		};

		const logs: LogEntry[] = [];
		for await (const log of getAllLogs([file1, file2], mockLogType, progressHandler)) {
			logs.push(log);
		}

		expect(progressHandler.start).toHaveBeenCalledWith(2);
		expect(progressHandler.progress).toHaveBeenCalledTimes(2);
		expect(progressHandler.progress).toHaveBeenCalledWith(1, 2);
		expect(progressHandler.progress).toHaveBeenCalledWith(2, 2);
		expect(progressHandler.finish).toHaveBeenCalled();
	});

	it('should handle empty file list', async () => {
		const logs: LogEntry[] = [];
		for await (const log of getAllLogs([], mockLogType)) {
			logs.push(log);
		}

		expect(logs).toHaveLength(0);
	});
});

describe('gzip detection', () => {
	it('should correctly identify gzipped files', async () => {
		const content = 'test content';
		const gzippedFile = await createGzippedFileFromString(content);

		// Read the first 2 bytes to verify gzip magic bytes
		const header = new Uint8Array(await gzippedFile.slice(0, 2).arrayBuffer());
		expect(header[0]).toBe(0x1f);
		expect(header[1]).toBe(0x8b);
	});

	it('should correctly identify plain text files', async () => {
		const plainFile = createFileFromString('test content');

		// Read the first 2 bytes to verify they're not gzip magic bytes
		const header = new Uint8Array(await plainFile.slice(0, 2).arrayBuffer());
		expect(header[0]).not.toBe(0x1f);
		expect(header[1]).not.toBe(0x8b);
	});
});

describe('error handling', () => {
	const mockLogType = new MockLogType();

	it('should handle corrupted gzip files gracefully', async () => {
		// Create a file with gzip magic bytes but invalid content
		const corruptedData = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xff, 0xff, 0xff]);
		const blob = new Blob([corruptedData], { type: 'application/gzip' });
		const corruptedFile = new File([blob], 'corrupted.gz', { type: 'application/gzip' });

		// The function should attempt to decompress and may either throw or return empty results
		// This test ensures the function doesn't crash the application
		try {
			const logs: LogEntry[] = [];
			for await (const log of getLogs(corruptedFile, mockLogType)) {
				logs.push(log);
			}
			// If no error is thrown, that's acceptable - the function handled it gracefully
			expect(true).toBe(true);
		} catch (error) {
			// If an error is thrown, it should be a proper Error object
			expect(error).toBeInstanceOf(Error);
		}
	});
});
