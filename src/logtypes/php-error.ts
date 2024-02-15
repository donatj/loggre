import { LogType } from "../controllers/LogReader";

export class PhpErrorLog implements LogType {

	smellsLikeLogLine(line: string): boolean {
		return line[0] === '[';
	}

}