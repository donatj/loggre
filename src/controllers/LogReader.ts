import { AbstractBaseController } from "../AbstractController";
import { factory } from "../Factory";

export class LogReaderController extends AbstractBaseController<HTMLDivElement> {

	private uploadButton = factory(function () {
		let elm = document.createElement('input');
		elm.type = 'file';
		elm.multiple = true;

		return elm
	});

	private groupers = factory(function () {
		let elm = document.createElement('textarea');
		elm.style.width = '300px';
		elm.style.height = '400px';

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
		elm.style.whiteSpace = 'pre';

		return elm
	});

	constructor() {
		super(document.createElement('div'), "log-reader");

		this.container.style.display = 'flex';

		let fieldset = document.createElement('fieldset');

		fieldset.append(
			this.uploadButton,
			document.createElement('br'),
			this.groupers,
			document.createElement('br'),
			this.runButton
		);

		this.container.append(
			fieldset,
			this.groupRunDetails
		);

		this.uploadButton.addEventListener('change', () => {
			this.runButton.disabled = !this.uploadButton.files?.length;
		});

		this.runButton.addEventListener('click', async () => {
			console.clear();

			const g = groupers(this.groupers.value);
			const grouperMap = g.map(g => { return { g: g, seen: 0 } });

			let unmatched = 0;

			for (const file of Array.from(this.uploadButton.files ?? [])) {
				for await (const log of getLogs(file)) {
					let matched = false;
					let show = true;
					for (const i in grouperMap) {
						if (grouperMap[i].g.matches(log)) {
							matched = true;
							grouperMap[i].seen++;
							if (grouperMap[i].seen > 1) {
								show = false;
							}
						}
					}

					if (!matched) {
						unmatched++;
					}

					if (show) {
						console.log(log); // External iteration and processing of each line
					}
				}
			}

			this.groupRunDetails.textContent = grouperMap.map(g => `${g.g.pattern}: ${g.seen}`).join('\n');
			this.groupRunDetails.textContent += `\n\nUngrouped: ${unmatched}`;
		});

		this.groupers.value = localStorage.getItem('groupers') ?? '';
		this.groupers.addEventListener('input', () => {
			localStorage.setItem('groupers', this.groupers.value);
		});
	}
}

function groupers(text: string) {
	return text.split('\n').map(line => new Grouper(line));
}

class Grouper {

	private reg: RegExp;

	constructor(public readonly pattern: string) {
		this.reg = new RegExp(pattern);
	}

	public matches(log: string): boolean {
		return this.reg.test(log);
	}
}

class Log {
	constructor(public log: string) { }
}

function smellsLikeLogLine(line: string): boolean {
	return line[0] === '[';
}

async function* getLogs(file: File): AsyncGenerator<string> {
	let log = "";
	for await (const line of getLines(file)) {
		if (smellsLikeLogLine(line)) {
			if (log) {
				yield log;
			}
			log = line;
		} else {
			log += "\n" + line;
		}
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