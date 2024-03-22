import { AbstractBaseController, labelFor } from "../AbstractController";
import { PhpErrorLog } from "../logtypes/php-error";
import { getAllLogs } from "../io";
import { LogEntry } from "../logtypes/Logs";

class LogDetailsDialog extends AbstractBaseController<HTMLDialogElement> {

	private output = (() => {
		let elm = document.createElement("output");
		elm.classList.add("details-output");
		elm.style.whiteSpace = "pre-wrap";

		return elm;
	})();

	private hideButton = (() => {
		let elm = document.createElement("button");
		elm.textContent = "Close";

		return elm;
	})();

	constructor() {
		super("details-dialog", document.createElement("dialog"));

		this.container.append(
			this.hideButton,
			this.output
		);

		this.hideButton.addEventListener("click", () => {
			this.container.close();
		});
	}

	public showDetails(entry: LogEntry) {
		this.output.textContent = entry.getRawEntry();
		this.container.showModal();
	}

}


export class LogReaderController extends AbstractBaseController {

	private uploadButton = (() => {
		let elm = document.createElement("input");
		elm.type = "file";
		elm.multiple = true;

		return elm;
	})();

	private groupers = (() => {
		let elm = document.createElement("textarea");

		elm.value = localStorage.getItem("groupers") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("groupers", elm.value);
		});

		return elm;
	})();

	private exclusions = (() => {
		let elm = document.createElement("textarea");

		elm.value = localStorage.getItem("exclusions") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("exclusions", elm.value);
		});

		return elm;
	})();

	private inclusions = (() => {
		let elm = document.createElement("textarea");

		elm.value = localStorage.getItem("inclusions") ?? "";
		elm.addEventListener("input", () => {
			localStorage.setItem("inclusions", elm.value);
		});

		return elm;
	})();

	private runButton = (() => {
		let elm = document.createElement("button");
		elm.textContent = "Run";
		elm.disabled = true;

		return elm;
	})();

	private logItemOutput = (() => {
		let elm = document.createElement("output");
		elm.classList.add("log-item-output");
		elm.style.whiteSpace = "pre-wrap";

		return elm;
	})();

	private maxLogSelect = (() => {
		let elm = document.createElement("select");
		elm.innerHTML = `
			<option>100</option>
			<option>1000</option>
			<option selected>10000</option>
			<option>100000</option>
			<option>1000000</option>
			<option value="all">All</option>
		`;

		return elm;
	})();

	private progressbar = (() => {
		let elm = document.createElement("progress");
		elm.value = 100;
		elm.max = 100;
		elm.style.width = "100%";

		return elm;
	})();

	private detailsDialog = new LogDetailsDialog;

	constructor() {
		super("log-reader", "main");

		const logType = new PhpErrorLog;

		let fieldset = document.createElement("fieldset");

		fieldset.append(
			this.uploadButton,
			document.createElement("br"),
			...labelFor("Exclusions", this.exclusions),
			...labelFor("Inclusions", this.inclusions),
			...labelFor("Groupers", this.groupers),
			...labelFor("Max logs", this.maxLogSelect),
			this.progressbar,
			this.runButton
		);

		this.container.append(
			fieldset,
			this.logItemOutput,
			this.detailsDialog.getContainer()
		);

		this.uploadButton.addEventListener("change", () => {
			this.runButton.disabled = !this.uploadButton.files?.length;
		});

		this.runButton.addEventListener("click", async () => {
			fieldset.disabled = true;
			this.logItemOutput.innerHTML = "";

			setTimeout(async () => {
				const e = matchers(this.exclusions.value);
				const i = matchers(this.inclusions.value);
				const g = matchers(this.groupers.value);

				let maxLogs = Infinity;
				if (this.maxLogSelect.value !== "all") {
					maxLogs = Number(this.maxLogSelect.value);
				}

				const grouperMap = g.map(g => new LogItemGroupController(g));
				for (const i of grouperMap) {
					this.logItemOutput.append(i.getContainer());
				}

				let ungrouped = 0;

				const files = Array.from(this.uploadButton.files ?? []);
				this.progressbar.style.visibility = "";
				this.progressbar.max = files.length;

				for await (const logEntry of getAllLogs(files, logType, (numerator: number, denominator: number) => {
					this.progressbar.value = numerator;
					this.progressbar.max = denominator;
				})) {
					const log = logEntry.getRawEntry();
					if (e.some(e => e.matches(log))) {
						continue;
					}

					if (i.length > 0 && i.some(i => !i.matches(log))) {
						continue;
					}

					const logItemController = new LogItemController(logEntry, this.detailsDialog);

					let matched = false;
					for (const g of grouperMap) {
						if (g.matches(log)) {
							g.addLog(logItemController);
							matched = true;
							break;
						}
					}

					if (!matched) {
						ungrouped++;
						this.logItemOutput.append(logItemController.getContainer());
					}

					if (ungrouped > maxLogs) {
						break;
					}
				}

				fieldset.disabled = false;
			}, 0);
		});
	}
}

class LogItemGroupController extends AbstractBaseController {

	private title = document.createElement("h1");

	private firstLog: LogItemController|null = null;

	private seen = 0;

	constructor(
		private matcher: Matcher,
		// private titleStr: string,
	) {
		super("log-item-group");
		this.container.classList.add("log-item-group"); // todo: remove this line

		this.updateTitle();

		this.container.append(
			this.title,
		);
	}

	public matches(log: string): boolean {
		return this.matcher.matches(log);
	}

	public addLog(log: LogItemController) {
		this.seen++;
		this.updateTitle();
		if (this.firstLog) {
			return;
		}
		this.firstLog = log;
		this.container.append(log.getContainer());
	}

	private titleTimeout: ReturnType<typeof setTimeout>|null = null;

	private updateTitle() {
		if (this.titleTimeout) {
			clearTimeout(this.titleTimeout);
		}

		this.titleTimeout = setTimeout(() => {
			this.title.innerText = `Group '${this.matcher.pattern}' matched ${new Intl.NumberFormat().format(this.seen)} times.`;
		}, 10);
	}
}

class LogItemController extends AbstractBaseController {

	private dateElm: HTMLElement;

	constructor(
		private readonly logEntry: LogEntry,
		detailsDialog: LogDetailsDialog,
	) {
		super("log-item");
		this.container.classList.add("log-item"); // todo: remove this line

		this.container.textContent = logEntry.getMessage();
		if (logEntry.hasDetails()) {
			this.container.textContent += "\n ... [details]";
		}

		this.dateElm = makeDate(logEntry);
		this.container.prepend(this.dateElm);

		let preventSingleClick = false;
		let clickTimeout: ReturnType<typeof setTimeout>|null = null;
		this.container.addEventListener("click", (e) => {
			console.log("click", preventSingleClick);

			// this lets you select text in the log item without triggering the details dialog
			const cellText = document.getSelection();
			if (cellText.type === "Range") {
				return;
			}

			if (preventSingleClick) {
				preventSingleClick = false;
				return;
			}

			if (clickTimeout) {
				clearTimeout(clickTimeout);
				clickTimeout = null;
				return;
			}

			clickTimeout = setTimeout(() => {
				if (!preventSingleClick) {
					detailsDialog.showDetails(logEntry);
				}
			}, 400);
		});

		this.container.addEventListener("dblclick", () => {
			console.log("dblclick", preventSingleClick);
			preventSingleClick = true;
			if (clickTimeout) {
				clearTimeout(clickTimeout);
				clickTimeout = null;
			}
		});
	}
}

type LogFilter = (logEntry: LogEntry) => boolean;

function matchers(text: string, m: typeof Matcher = Matcher) {
	return text.trim().split("\n").filter((v) => v.trim() != "").map(line => new m(line));
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


function makeDate(logEntry: LogEntry) {
	const dateElm = document.createElement("time");
	const date = logEntry.getDate();
	dateElm.dateTime = date.toISOString();
	dateElm.textContent = date.toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short"
	});
	return dateElm;
}
