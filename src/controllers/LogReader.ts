import { AbstractBaseController, factory, labelFor } from "../AbstractController";
import { PhpErrorLog } from "../logtypes/php-error";
import { getLogs } from "../io";
import { LogEntry } from "../logtypes/Logs";

class LogDetailsDialog extends AbstractBaseController<HTMLDialogElement> {

	private output = factory(function () {
		let elm = document.createElement('output');
		elm.classList.add('details-output');
		elm.style.whiteSpace = 'pre-wrap';

		return elm
	});

	private hideButton = factory(function () {
		let elm = document.createElement('button');
		elm.textContent = 'Close';

		return elm
	});
	
	constructor() {
		super("details-dialog", document.createElement('dialog'));

		this.container.append(
			this.hideButton,
			this.output
		)

		this.hideButton.addEventListener('click', () => {
			this.container.close();
		});
	}

	public showDetails(entry: LogEntry) {
		this.output.textContent = entry.getRawEntry();
		this.container.showModal();
	}

}

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

	private logItemOutput = factory(function () {
		let elm = document.createElement('output');
		elm.classList.add('log-item-output');
		elm.style.whiteSpace = 'pre-wrap';

		return elm
	});

	private progressbar = factory(function () {
		let elm = document.createElement('progress');
		elm.value = 100;
		elm.max = 100;
		elm.style.width = '100%';

		return elm
	});

	private detailsDialog = new LogDetailsDialog;

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
			this.progressbar,
			this.runButton
		);

		this.container.append(
			fieldset,
			this.logItemOutput,
			this.detailsDialog.getContainer()
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

				const grouperMap = g.map(g => { return { g: g, seen: 0, seenElm: factory(()=>{
					let elm = document.createElement('h5');
					return elm;
				}) } });

				let ungrouped = 0;

				const files = Array.from(this.uploadButton.files ?? []);
				this.progressbar.style.visibility = '';
				this.progressbar.max = files.length;
				for (const file of files) {
					this.progressbar.value = files.indexOf(file) + 1;

					for await (const logEntry of getLogs(file, logType)) {
						const log = logEntry.getRawEntry();
						if (e.some(e => e.matches(log))) {
							continue;
						}

						if (i.length > 0 && i.some(i => !i.matches(log))) {
							continue;
						}

						let grouped = false;
						let groupSeenElm : HTMLElement | null = null;
						let show = true;
						for (const i in grouperMap) {
							if (grouperMap[i].g.matches(log)) {
								groupSeenElm = grouperMap[i].seenElm;
								grouped = true;
								grouperMap[i].seen++;
								groupSeenElm.textContent = `Group '${grouperMap[i].g.pattern}' matched: ${grouperMap[i].seen} times.`;
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
							logItem.textContent = logEntry.getMessage();
							if (logEntry.hasDetails()) {
								logItem.textContent += "\n ... [details]";
							}

							logItem.addEventListener('click', () => {
								this.detailsDialog.showDetails(logEntry);
							});

							if (grouped) {
								let group = document.createElement('article');
								group.classList.add('log-item-group');
								group.append(
									groupSeenElm, 
									document.createElement('br'),
									logItem
								);
								
								this.logItemOutput.append(group);
							} else {
								this.logItemOutput.append(logItem);
							}
						}
					}
				}

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

class Grouper extends Matcher { }
class Excluder extends Matcher { }
class Includer extends Matcher { }


