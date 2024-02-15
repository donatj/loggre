import { AbstractBaseController, factory, labelFor } from "../AbstractController";
import { PhpErrorLog } from "../logtypes/php-error";

export class LogReaderController extends AbstractBaseController {

	private uploadButton = factory(function () {
		let elm = document.createElement('input');
		elm.type = 'file';
		elm.multiple = true;

		return elm
	});

	private groupers = factory(function () {
		let elm = document.createElement('textarea');

		elm.value = localStorage.getItem('groupers') ?? '';
		elm.addEventListener('input', () => {
			localStorage.setItem('groupers', elm.value);
		});

		return elm
	});

	private exclusions = factory(function () {
		let elm = document.createElement('textarea');

		elm.value = localStorage.getItem('exclusions') ?? '';
		elm.addEventListener('input', () => {
			localStorage.setItem('exclusions', elm.value);
		});

		return elm
	});

	private inclusions = factory(function () {
		let elm = document.createElement('textarea');

		elm.value = localStorage.getItem('inclusions') ?? '';
		elm.addEventListener('input', () => {
			localStorage.setItem('inclusions', elm.value);
		});

		return elm
	});

	private runButton = factory(function () {
		let elm = document.createElement('button');
		elm.textContent = 'Run';
		elm.disabled = true;

		return elm
	});

	private groupRunDetails = factory(function () {
		let elm = document.createElement('output');
		elm.classList.add('group-run-details');
		elm.style.whiteSpace = 'pre';

		return elm
	});

	private logItemOutput = factory(function () {
		let elm = document.createElement('output');
		elm.classList.add('log-item-output');
		elm.style.whiteSpace = 'pre';

		return elm
	});

	constructor() {
		super("log-reader", "main");

		const logType = new PhpErrorLog;

		let fieldset = document.createElement('fieldset');

		fieldset.append(
			this.uploadButton,
			document.createElement('br'),
			...labelFor('Exclusions', this.exclusions),
			...labelFor('Inclusions', this.inclusions),
			...labelFor('Groupers', this.groupers),
			document.createElement('br'),
			this.runButton
		);

		this.container.append(
			fieldset,
			this.groupRunDetails,
			this.logItemOutput
		);

		this.uploadButton.addEventListener('change', () => {
			this.runButton.disabled = !this.uploadButton.files?.length;
		});

		this.runButton.addEventListener('click', async () => {
			fieldset.disabled = true;

			this.logItemOutput.textContent = '';

			setTimeout(async () => {
				const e = matchers(this.exclusions.value, Excluder);
				const i = matchers(this.inclusions.value, Includer);
				const g = matchers(this.groupers.value, Grouper);
	
				const grouperMap = g.map(g => { return { g: g, seen: 0 } });
	
				let ungrouped = 0;

				for (const file of Array.from(this.uploadButton.files ?? [])) {
					for await (const log of getLogs(file, logType)) {
						if (e.some(e => e.matches(log))) {
							continue;
						}

						if (i.length > 0 && i.some(i => !i.matches(log))) {
							continue;
						}

						let grouped = false;
						let show = true;
						for (const i in grouperMap) {
							if (grouperMap[i].g.matches(log)) {
								grouped = true;
								grouperMap[i].seen++;
								if (grouperMap[i].seen > 1) {
									show = false;
								}
								break;
							}
						}

						if (!grouped) {
							ungrouped++;
						}

						if (show) {
							let logItem = document.createElement('div');
							logItem.classList.add('log-item');
							logItem.textContent = log;
							if (grouped) {
								let group = document.createElement('article');
								group.classList.add('log-item-group');
								group.append(logItem);
								this.logItemOutput.append(group);
							}else{
								this.logItemOutput.append(logItem);
							}
							// this.logItemOutput.textContent += log + '\n';
						}
					}
				}

				this.groupRunDetails.textContent = grouperMap.map(g => `${g.g.pattern}: ${g.seen}`).join('\n');
				this.groupRunDetails.textContent += `\n\nUngrouped: ${ungrouped}`;

				fieldset.disabled = false;
			}, 0);
		});
	}
}

function matchers(text: string, m: typeof Matcher = Matcher) {
	return text.trim().split('\n').filter((v) => v.trim() != '').map(line => new m(line));
}

class Matcher {

	private reg: RegExp;

	constructor(public readonly pattern: string) {
		this.reg = new RegExp(pattern);
	}

	public matches(log: string): boolean {
		return this.reg.test(log);
	}
}

class Grouper extends Matcher {}
class Excluder extends Matcher {}
class Includer extends Matcher {}

class Log {
	constructor(public log: string) { }
}



export interface LogType {
	smellsLikeLogLine(line: string): boolean;
}

async function* getLogs(file: File, type: LogType): AsyncGenerator<string> {
	let log = "";
	for await (const line of getLines(file)) {
		if (type.smellsLikeLogLine(line)) {
			if (log) {
				yield log;
			}
			log = line;
		} else {
			log += "\n" + line;
		}
	}

	if (log) {
		yield log;
	}
}

async function* getLines(file: File): AsyncGenerator<string> {
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